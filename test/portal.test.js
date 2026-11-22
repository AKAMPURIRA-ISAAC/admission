import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:net";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { makeAdmissionNumber } from "../src/admission-number.js";
import { hashPassword } from "../src/password.js";
import { validateApplication } from "../src/validation.js";

const projectDirectory = fileURLToPath(new URL("../", import.meta.url));
const applicationPayload = {
  studentName: "Akello Grace",
  sex: "Female",
  dateOfBirth: "2012-05-10",
  joiningClass: "Senior 2",
  studentEmail: "akello@example.com",
  nationality: "Ugandan",
  district: "Kyenjojo",
  subcounty: "Kyenjojo Town Council",
  county: "",
  parish: "Kijuma",
  village: "Nyakabara",
  previousSchoolName: "Kyenjojo Secondary School",
  previousSchoolLin: "123456789",
  motherAlive: false,
  motherName: "Should not be stored",
  motherNin: "Should not be stored",
  motherContact: "Should not be stored",
  fatherAlive: true,
  fatherName: "Okello John",
  fatherNin: "CM9876543210CD",
  fatherContact: "+256772333444",
  parentContact: "+256700000000",
  parentWhatsapp: "+256700000000",
  supportNeeds: "",
  referralSource: "teacher",
  referralDetails: "",
};

async function getAvailablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  return port;
}

test("admission validation and protected admin application flow", async (t) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "heart-hands-"));
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const databasePath = join(temporaryDirectory, "test.sqlite");
  let serverProcess;
  let testDatabase;

  t.after(async () => {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill();
      await once(serverProcess, "exit");
    }
    await testDatabase?.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  process.env.ADMISSIONS_DB_PATH = databasePath;
  const { createAdmin, database } = await import("../src/db.js");
  testDatabase = database;
  const credentials = await hashPassword("correct-horse-battery-staple");
  await createAdmin({ username: "test-admin", ...credentials });

  serverProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: projectDirectory,
    env: {
      ...process.env,
      ADMISSIONS_DB_PATH: databasePath,
      NODE_ENV: "test",
      PORT: String(port),
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      ADMISSIONS_EMAIL_TO: "",
      ADMISSIONS_EMAIL_FROM: "",
    },
    stdio: "ignore",
  });

  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Server exited during startup with code ${serverProcess.exitCode}.`);
    }
    try {
      const response = await fetch(`${baseUrl}/`);
      ready = response.ok;
      if (ready) {
        break;
      }
    } catch {
      await delay(100);
    }
  }
  assert.equal(ready, true, "server should start and serve the admission form");
  assert.equal((await fetch(`${baseUrl}/styles.css`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/admin.html`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/package.json`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/db.js`)).status, 404);

  const invalidApplication = { ...applicationPayload, dateOfBirth: "2030-01-01" };
  assert.throws(() => validateApplication(invalidApplication), /date of birth/);
  const validApplication = validateApplication(applicationPayload);
  assert.equal(validApplication.age, 14, "age is derived from date of birth");
  assert.equal(validApplication.motherName, "", "deceased parent's details are discarded");
  assert.throws(
    () => validateApplication({ ...applicationPayload, previousSchoolLin: "" }),
    /identification number \(LIN\) is required for Senior 2/i,
  );

  const generatedNumbers = new Set(
    Array.from({ length: 100 }, () => makeAdmissionNumber()),
  );
  assert.equal(generatedNumbers.size, 100, "admission numbers should be unique in a sample");
  assert.match([...generatedNumbers][0], /^HH-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);

  const sessionCheck = await fetch(`${baseUrl}/api/admin/session`);
  assert.equal(sessionCheck.status, 200);
  assert.equal((await sessionCheck.json()).admin, null);
  const unauthorized = await fetch(`${baseUrl}/api/admin/applications`);
  assert.equal(unauthorized.status, 401);

  const failedLogin = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ username: "test-admin", password: "incorrect-password" }),
  });
  assert.equal(failedLogin.status, 401);

  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({
      username: "test-admin",
      password: "correct-horse-battery-staple",
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];

  const submission = await fetch(`${baseUrl}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify(applicationPayload),
  });
  assert.equal(submission.status, 201);
  const created = await submission.json();
  assert.equal(created.age, 14);
  assert.match(created.admissionNumber, /^HH-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.deepEqual(created.notifications.applicantEmail, {
    sent: false,
    reason: "not_configured",
  });

  const byStudentName = await fetch(
    `${baseUrl}/api/admin/applications?search=Akello`,
    { headers: { Cookie: cookie } },
  );
  assert.equal(byStudentName.status, 200);
  const searchResults = await byStudentName.json();
  assert.equal(searchResults.total, 1);
  assert.equal(searchResults.applications[0].admissionNumber, created.admissionNumber);

  const byAdmissionNumber = await fetch(
    `${baseUrl}/api/admin/applications?search=${created.admissionNumber.toLowerCase()}`,
    { headers: { Cookie: cookie } },
  );
  assert.equal((await byAdmissionNumber.json()).total, 1);

  const detail = await fetch(
    `${baseUrl}/api/admin/applications/${created.admissionNumber}`,
    { headers: { Cookie: cookie } },
  );
  const detailResult = await detail.json();
  assert.equal(detailResult.application.motherName, "");
  assert.equal(detailResult.application.fatherNin, "CM9876543210CD");
  assert.equal(detailResult.application.studentEmail, "akello@example.com");
  assert.equal(detailResult.application.joiningClass, "Senior 2");
  assert.equal(detailResult.application.parentWhatsapp, "+256700000000");

  const update = await fetch(
    `${baseUrl}/api/admin/applications/${created.admissionNumber}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
        Cookie: cookie,
      },
      body: JSON.stringify({ status: "reviewing" }),
    },
  );
  assert.equal(update.status, 200);
  assert.equal((await update.json()).status, "reviewing");

  const rejectionWithoutReason = await fetch(
    `${baseUrl}/api/admin/applications/${created.admissionNumber}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
        Cookie: cookie,
      },
      body: JSON.stringify({ status: "rejected" }),
    },
  );
  assert.equal(rejectionWithoutReason.status, 400);

  const rejection = await fetch(
    `${baseUrl}/api/admin/applications/${created.admissionNumber}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
        Cookie: cookie,
      },
      body: JSON.stringify({
        status: "rejected",
        rejectionReason: "The required application criteria were not met for this intake.",
      }),
    },
  );
  assert.equal(rejection.status, 200);
  const rejectionResult = await rejection.json();
  assert.deepEqual(rejectionResult.notification, { sent: false, reason: "not_configured" });
  const rejectedApplication = await fetch(
    `${baseUrl}/api/admin/applications/${created.admissionNumber}`,
    { headers: { Cookie: cookie } },
  );
  assert.equal(
    (await rejectedApplication.json()).application.rejectionReason,
    "The required application criteria were not met for this intake.",
  );

  const logout = await fetch(`${baseUrl}/api/admin/logout`, {
    method: "POST",
    headers: { Origin: baseUrl, Cookie: cookie },
  });
  assert.equal(logout.status, 204);
  const afterLogout = await fetch(`${baseUrl}/api/admin/applications`, {
    headers: { Cookie: cookie },
  });
  assert.equal(afterLogout.status, 401);
});
