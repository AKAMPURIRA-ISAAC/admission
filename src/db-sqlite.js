import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const databasePath = resolve(process.env.ADMISSIONS_DB_PATH || "data/admissions.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

export const database = new DatabaseSync(databasePath);

database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY,
    admission_number TEXT NOT NULL UNIQUE,
    student_name TEXT NOT NULL,
    age INTEGER NOT NULL,
    sex TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    nationality TEXT NOT NULL,
    district TEXT NOT NULL,
    subcounty TEXT NOT NULL,
    county TEXT NOT NULL,
    parish TEXT NOT NULL,
    village TEXT NOT NULL,
    mother_alive INTEGER NOT NULL,
    mother_name TEXT NOT NULL,
    mother_nin TEXT NOT NULL,
    mother_contact TEXT NOT NULL,
    father_alive INTEGER NOT NULL,
    father_name TEXT NOT NULL,
    father_nin TEXT NOT NULL,
    father_contact TEXT NOT NULL,
    parent_contact TEXT NOT NULL,
    student_email TEXT NOT NULL DEFAULT '',
    parent_whatsapp TEXT NOT NULL DEFAULT '',
    joining_class TEXT NOT NULL DEFAULT '',
    previous_school_name TEXT NOT NULL DEFAULT '',
    previous_school_lin TEXT NOT NULL DEFAULT '',
    support_needs TEXT NOT NULL DEFAULT '',
    referral_source TEXT NOT NULL DEFAULT '',
    referral_details TEXT NOT NULL DEFAULT '',
    rejection_reason TEXT NOT NULL DEFAULT '',
    rejection_email_sent_at TEXT,
    status TEXT NOT NULL DEFAULT 'received'
      CHECK (status IN ('received', 'reviewing', 'admitted', 'rejected')),
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS applications_student_name_idx
    ON applications(student_name COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS applications_created_at_idx
    ON applications(created_at DESC);
`);

const existingApplicationColumns = new Set(
  database.prepare("PRAGMA table_info(applications)").all().map(({ name }) => name),
);
const applicationMigrations = {
  student_email: "TEXT NOT NULL DEFAULT ''",
  parent_whatsapp: "TEXT NOT NULL DEFAULT ''",
  joining_class: "TEXT NOT NULL DEFAULT ''",
  previous_school_name: "TEXT NOT NULL DEFAULT ''",
  previous_school_lin: "TEXT NOT NULL DEFAULT ''",
  support_needs: "TEXT NOT NULL DEFAULT ''",
  referral_source: "TEXT NOT NULL DEFAULT ''",
  referral_details: "TEXT NOT NULL DEFAULT ''",
  rejection_reason: "TEXT NOT NULL DEFAULT ''",
  rejection_email_sent_at: "TEXT",
};
for (const [column, definition] of Object.entries(applicationMigrations)) {
  if (!existingApplicationColumns.has(column)) {
    database.exec(`ALTER TABLE applications ADD COLUMN ${column} ${definition}`);
  }
}

export function createAdmin({ username, passwordSalt, passwordHash }) {
  return database.prepare(`
    INSERT INTO admins (username, password_salt, password_hash, created_at)
    VALUES (?, ?, ?, ?)
  `).run(username, passwordSalt, passwordHash, new Date().toISOString());
}

export function findAdminByUsername(username) {
  return database.prepare(`
    SELECT id, username, password_salt AS passwordSalt, password_hash AS passwordHash
    FROM admins
    WHERE username = ?
  `).get(username);
}

export function saveSession({ tokenHash, adminId, expiresAt }) {
  database.prepare(`
    INSERT INTO admin_sessions (token_hash, admin_id, expires_at)
    VALUES (?, ?, ?)
  `).run(tokenHash, adminId, expiresAt);
}

export function findSession(tokenHash) {
  return database.prepare(`
    SELECT admins.id, admins.username
    FROM admin_sessions
    JOIN admins ON admins.id = admin_sessions.admin_id
    WHERE admin_sessions.token_hash = ?
      AND admin_sessions.expires_at > ?
  `).get(tokenHash, new Date().toISOString());
}

export function deleteSession(tokenHash) {
  database.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash);
}

export function deleteExpiredSessions() {
  database.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(new Date().toISOString());
}

export function createApplication(application, makeAdmissionNumber) {
  const insert = database.prepare(`
    INSERT INTO applications (
      admission_number, student_name, age, sex, date_of_birth, nationality,
      district, subcounty, county, parish, village, mother_alive, mother_name,
      mother_nin, mother_contact, father_alive, father_name, father_nin,
      father_contact, parent_contact, student_email, parent_whatsapp, joining_class,
      previous_school_name, previous_school_lin, support_needs, referral_source,
      referral_details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const numberExists = database.prepare(
    "SELECT 1 FROM applications WHERE admission_number = ?",
  );

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const admissionNumber = makeAdmissionNumber();
    if (numberExists.get(admissionNumber)) {
      continue;
    }

    try {
      insert.run(
        admissionNumber,
        application.studentName,
        application.age,
        application.sex,
        application.dateOfBirth,
        application.nationality,
        application.district,
        application.subcounty,
        application.county,
        application.parish,
        application.village,
        Number(application.motherAlive),
        application.motherName,
        application.motherNin,
        application.motherContact,
        Number(application.fatherAlive),
        application.fatherName,
        application.fatherNin,
        application.fatherContact,
        application.parentContact,
        application.studentEmail,
        application.parentWhatsapp,
        application.joiningClass,
        application.previousSchoolName,
        application.previousSchoolLin,
        application.supportNeeds,
        application.referralSource,
        application.referralDetails,
        new Date().toISOString(),
      );
      return admissionNumber;
    } catch (error) {
      if (String(error.message).includes("applications.admission_number")) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not allocate a unique admission number after several attempts.");
}

const applicationSummaryColumns = `
  admission_number AS admissionNumber,
  student_name AS studentName,
  age,
  sex,
  district,
  student_email AS studentEmail,
  parent_contact AS parentContact,
  parent_whatsapp AS parentWhatsapp,
  joining_class AS joiningClass,
  status,
  created_at AS createdAt
`;

export function listApplications({ search, status, limit, offset }) {
  const filters = [];
  const parameters = [];

  if (search) {
    filters.push("(student_name LIKE ? COLLATE NOCASE OR admission_number LIKE ? COLLATE NOCASE)");
    parameters.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    filters.push("status = ?");
    parameters.push(status);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const total = database.prepare(`SELECT COUNT(*) AS count FROM applications ${where}`)
    .get(...parameters).count;
  const applications = database.prepare(`
    SELECT ${applicationSummaryColumns}
    FROM applications
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...parameters, limit, offset);

  return { applications, total };
}

export function findApplication(admissionNumber) {
  return database.prepare(`
    SELECT
      admission_number AS admissionNumber,
      student_name AS studentName,
      age,
      sex,
      date_of_birth AS dateOfBirth,
      nationality,
      district,
      subcounty,
      county,
      parish,
      village,
      mother_alive AS motherAlive,
      mother_name AS motherName,
      mother_nin AS motherNin,
      mother_contact AS motherContact,
      father_alive AS fatherAlive,
      father_name AS fatherName,
      father_nin AS fatherNin,
      father_contact AS fatherContact,
      parent_contact AS parentContact,
      student_email AS studentEmail,
      parent_whatsapp AS parentWhatsapp,
      joining_class AS joiningClass,
      previous_school_name AS previousSchoolName,
      previous_school_lin AS previousSchoolLin,
      support_needs AS supportNeeds,
      referral_source AS referralSource,
      referral_details AS referralDetails,
      rejection_reason AS rejectionReason,
      rejection_email_sent_at AS rejectionEmailSentAt,
      status,
      created_at AS createdAt
    FROM applications
    WHERE admission_number = ?
  `).get(admissionNumber);
}

export function updateApplicationStatus(admissionNumber, status, rejectionReason = "") {
  const current = database.prepare(`
    SELECT status, rejection_reason AS rejectionReason,
      rejection_email_sent_at AS rejectionEmailSentAt
    FROM applications
    WHERE admission_number = ?
  `).get(admissionNumber);
  if (!current) {
    return null;
  }

  const reason = status === "rejected" ? rejectionReason : "";
  const reasonChanged = current.rejectionReason !== reason;
  const rejectionEmailSentAt = status === "rejected" && !reasonChanged
    ? current.rejectionEmailSentAt
    : null;

  database.prepare(`
    UPDATE applications
    SET status = ?, rejection_reason = ?, rejection_email_sent_at = ?
    WHERE admission_number = ?
  `).run(status, reason, rejectionEmailSentAt, admissionNumber);

  return {
    rejectionEmailRequired: status === "rejected" && !rejectionEmailSentAt,
    rejectionEmailPreviouslySent: status === "rejected" && Boolean(rejectionEmailSentAt),
  };
}

export function markRejectionEmailSent(admissionNumber) {
  database.prepare(`
    UPDATE applications
    SET rejection_email_sent_at = ?
    WHERE admission_number = ? AND status = 'rejected'
  `).run(new Date().toISOString(), admissionNumber);
}
