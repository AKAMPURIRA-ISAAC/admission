const fields = {
  studentName: 100,
  nationality: 80,
  district: 100,
  subcounty: 100,
  county: 100,
  parish: 100,
  village: 100,
  motherName: 100,
  motherNin: 32,
  motherContact: 32,
  fatherName: 100,
  fatherNin: 32,
  fatherContact: 32,
  parentContact: 32,
  studentEmail: 254,
  parentWhatsapp: 32,
  joiningClass: 16,
  previousSchoolName: 120,
  previousSchoolLin: 32,
  supportNeeds: 1000,
  referralSource: 32,
  referralDetails: 120,
};

const referralSources = new Set([
  "",
  "friend-family",
  "social-media",
  "teacher",
  "school-visit",
  "community",
  "church",
  "radio",
  "other",
]);

function readText(body, field, maxLength, required = false) {
  const value = body[field];
  if (value === undefined || value === null) {
    if (required) {
      throw new Error(`${field} is required.`);
    }
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be text.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${field} must be no more than ${maxLength} characters.`);
  }
  if (required && !normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

export function validateApplication(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Application details must be sent as an object.");
  }

  const application = {};
  for (const [field, maxLength] of Object.entries(fields)) {
    const required = [
      "studentName",
      "nationality",
      "district",
      "parentContact",
      "studentEmail",
      "joiningClass",
    ].includes(field);
    application[field] = readText(body, field, maxLength, required);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.studentEmail)) {
    throw new Error("Please provide a valid email address.");
  }
  if (!["Senior 1", "Senior 2"].includes(application.joiningClass)) {
    throw new Error("Please select Senior 1 or Senior 2.");
  }
  if (application.joiningClass === "Senior 2") {
    if (!application.previousSchoolName) {
      throw new Error("The previous secondary school name is required for Senior 2 applicants.");
    }
    if (!application.previousSchoolLin) {
      throw new Error("A learner identification number (LIN) is required for Senior 2 applicants.");
    }
  } else {
    application.previousSchoolName = "";
    application.previousSchoolLin = "";
  }
  if (!referralSources.has(application.referralSource)) {
    throw new Error("Please choose a valid referral source.");
  }
  if (application.referralSource !== "other") {
    application.referralDetails = "";
  }

  if (!["Female", "Male"].includes(body.sex)) {
    throw new Error("Please choose a valid sex.");
  }
  application.sex = body.sex;

  if (typeof body.dateOfBirth !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth) ||
      Number.isNaN(Date.parse(`${body.dateOfBirth}T00:00:00Z`)) ||
      new Date(`${body.dateOfBirth}T00:00:00Z`).toISOString().slice(0, 10) !== body.dateOfBirth ||
      body.dateOfBirth > new Date().toISOString().slice(0, 10)) {
    throw new Error("Please provide a valid date of birth that is not in the future.");
  }
  application.dateOfBirth = body.dateOfBirth;
  const today = new Date().toISOString().slice(0, 10);
  const birthYear = Number(body.dateOfBirth.slice(0, 4));
  const birthMonthDay = body.dateOfBirth.slice(5);
  const todayMonthDay = today.slice(5);
  application.age = Number(today.slice(0, 4)) - birthYear -
    (todayMonthDay < birthMonthDay ? 1 : 0);
  if (application.age < 10 || application.age > 25) {
    throw new Error("The student's age, calculated from their date of birth, must be between 10 and 25.");
  }

  for (const field of ["motherAlive", "fatherAlive"]) {
    if (typeof body[field] !== "boolean") {
      throw new Error(`${field} must be true or false.`);
    }
    application[field] = body[field];
  }

  if (!application.motherAlive) {
    application.motherName = "";
    application.motherNin = "";
    application.motherContact = "";
  }
  if (!application.fatherAlive) {
    application.fatherName = "";
    application.fatherNin = "";
    application.fatherContact = "";
  }

  return application;
}
