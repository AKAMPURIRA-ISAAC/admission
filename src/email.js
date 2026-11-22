import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

function emailConfiguration(requireAdminRecipient = false) {
  const transport = getTransporter();
  const recipient = process.env.ADMISSIONS_EMAIL_TO;
  const sender = process.env.ADMISSIONS_EMAIL_FROM;

  if (!transport || !sender || (requireAdminRecipient && !recipient)) {
    return null;
  }

  return { transport, sender, adminRecipient: recipient };
}

function studentSalutation({ studentName, sex }) {
  const title = sex === "Male" ? "Mr." : "Ms.";
  return `Dear ${title} ${studentName},`;
}

async function sendEmail(to, subject, text) {
  const configuration = emailConfiguration();
  if (!configuration) {
    return { sent: false, reason: "not_configured" };
  }

  await configuration.transport.sendMail({
    from: configuration.sender,
    to,
    subject,
    text,
  });
  return { sent: true };
}

export async function sendApplicationNotification({ admissionNumber, studentName }) {
  const configuration = emailConfiguration(true);
  if (!configuration) {
    return { sent: false, reason: "not_configured" };
  }
  const baseUrl = (
    process.env.PUBLIC_BASE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    ""
  ).replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const absoluteBaseUrl = baseUrl ? `https://${baseUrl}` : "";
  const portalLink = absoluteBaseUrl
    ? `${absoluteBaseUrl}/admin.html`
    : "the admissions admin portal";

  return sendEmail(
    configuration.adminRecipient,
    `New admission application: ${admissionNumber}`,
    [
      "A new student application has been saved in the admissions portal.",
      "",
      `Student: ${studentName}`,
      `Admission number: ${admissionNumber}`,
      "",
      `Sign in to review the application: ${portalLink}`,
      "",
      "For student privacy, the email does not contain personal application details.",
    ].join("\n"),
  );
}

export function sendApplicantReceipt({
  admissionNumber,
  studentEmail,
  studentName,
  sex,
  joiningClass,
}) {
  return sendEmail(
    studentEmail,
    `Application received: ${admissionNumber}`,
    [
      studentSalutation({ studentName, sex }),
      "",
      `We have received your application to join ${joiningClass} at Heart & Hands Vocational Secondary School.`,
      `Your admission number is ${admissionNumber}. Keep it for future communication.`,
      "",
      "If we need more details or would like to arrange a visit to the school, our admissions team will contact you using the email or guardian WhatsApp number provided.",
      "",
      "This message confirms receipt of your application; it is not an admission decision.",
      "",
      "Heart & Hands Vocational Secondary School Admissions",
    ].join("\n"),
  );
}

export function sendRejectionNotice({
  admissionNumber,
  studentEmail,
  studentName,
  sex,
  rejectionReason,
}) {
  return sendEmail(
    studentEmail,
    `Application update: ${admissionNumber}`,
    [
      studentSalutation({ studentName, sex }),
      "",
      `Thank you for applying to Heart & Hands Vocational Secondary School. We regret to inform you that your application (${admissionNumber}) has not been successful.`,
      "",
      "Details:",
      rejectionReason,
      "",
      "If you have questions about this decision, please contact the admissions office.",
      "",
      "Heart & Hands Vocational Secondary School Admissions",
    ].join("\n"),
  );
}
