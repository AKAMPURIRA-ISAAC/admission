import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  createApplication,
  deleteExpiredSessions,
  findAdminByUsername,
  findApplication,
  listApplications,
  markRejectionEmailSent,
  updateApplicationStatus,
} from "./db.js";
import {
  createAdminSession,
  endAdminSession,
  expiredSessionCookieOptions,
  getAdminBySession,
  readSessionToken,
  requireAdmin,
  sessionCookieName,
  sessionCookieOptions,
} from "./admin-auth.js";
import { makeAdmissionNumber } from "./admission-number.js";
import {
  sendApplicantReceipt,
  sendApplicationNotification,
  sendRejectionNotice,
} from "./email.js";
import { verifyPassword } from "./password.js";
import { validateApplication } from "./validation.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = resolve(sourceDirectory, "../public");
const validStatuses = new Set(["received", "reviewing", "admitted", "rejected"]);
const fakePasswordSalt = Buffer.alloc(16, 0).toString("hex");
const fakePasswordHash = "0".repeat(128);

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
const contentSecurityPolicy = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  connectSrc: ["'self'"],
  fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  imgSrc: ["'self'", "https://images.unsplash.com", "data:"],
  objectSrc: ["'none'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
};
if (process.env.NODE_ENV === "production") {
  contentSecurityPolicy.upgradeInsecureRequests = [];
}
app.use(helmet({
  contentSecurityPolicy: { directives: contentSecurityPolicy },
}));
app.use(express.json({ limit: "32kb" }));

function sameOrigin(request, response, next) {
  const origin = request.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.get("host")) {
        response.status(403).json({ error: "Cross-origin requests are not allowed." });
        return;
      }
    } catch {
      response.status(403).json({ error: "Invalid request origin." });
      return;
    }
  }
  next();
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please wait and try again." },
});

const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many applications from this connection. Please try again later." },
});

app.post("/api/applications", submissionLimiter, sameOrigin, async (request, response) => {
  let application;
  try {
    application = validateApplication(request.body);
  } catch (error) {
    response.status(400).json({ error: error.message });
    return;
  }

  let admissionNumber;
  try {
    admissionNumber = await createApplication(application, makeAdmissionNumber);
  } catch (error) {
    console.error("Could not save an admission application:", error);
    response.status(500).json({ error: "We could not save your application. Please try again." });
    return;
  }

  const notifications = await Promise.all([
    sendApplicationNotification({
      admissionNumber,
      studentName: application.studentName,
    }),
    sendApplicantReceipt({
      admissionNumber,
      studentEmail: application.studentEmail,
      studentName: application.studentName,
      sex: application.sex,
      joiningClass: application.joiningClass,
    }),
  ].map(async (notification) => {
    try {
      return await notification;
    } catch (error) {
      console.error(`Email notification failed for ${admissionNumber}:`, error.message);
      return { sent: false, reason: "delivery_failed" };
    }
  }));

  response.status(201).json({
    admissionNumber,
    studentName: application.studentName,
    age: application.age,
    notifications: {
      schoolEmail: notifications[0],
      applicantEmail: notifications[1],
    },
  });
});

app.get("/api/admin/session", async (request, response) => {
  const admin = await getAdminBySession(request);
  response.json({ admin: admin ? { username: admin.username } : null });
});

app.post("/api/admin/login", loginLimiter, sameOrigin, async (request, response) => {
  const username = typeof request.body?.username === "string"
    ? request.body.username.trim().slice(0, 80)
    : "";
  const password = typeof request.body?.password === "string"
    ? request.body.password.slice(0, 256)
    : "";
  const admin = username ? await findAdminByUsername(username) : null;
  const passwordMatches = await verifyPassword(
    password,
    admin?.passwordSalt || fakePasswordSalt,
    admin?.passwordHash || fakePasswordHash,
  );

  if (!admin || !passwordMatches) {
    response.status(401).json({ error: "Invalid username or password." });
    return;
  }

  await deleteExpiredSessions();
  const session = await createAdminSession(admin.id);
  response.setHeader("Set-Cookie", `${sessionCookieName}=${session.token}; ${sessionCookieOptions()}`);
  response.json({ admin: { username: admin.username } });
});

app.post("/api/admin/logout", sameOrigin, requireAdmin, async (request, response) => {
  await endAdminSession(request);
  response.setHeader("Set-Cookie", `${sessionCookieName}=; ${expiredSessionCookieOptions()}`);
  response.status(204).end();
});

app.get("/api/admin/applications", requireAdmin, async (request, response) => {
  const search = typeof request.query.search === "string"
    ? request.query.search.trim().slice(0, 100)
    : "";
  const status = typeof request.query.status === "string" ? request.query.status : "";
  if (status && !validStatuses.has(status)) {
    response.status(400).json({ error: "Invalid application status filter." });
    return;
  }

  const parsedPage = Number.parseInt(request.query.page, 10);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 100000) : 1;
  const limit = 25;
  const result = await listApplications({
    search,
    status,
    limit,
    offset: (page - 1) * limit,
  });
  response.json({ ...result, page, pageSize: limit });
});

app.get("/api/admin/applications/:admissionNumber", requireAdmin, async (request, response) => {
  const application = await findApplication(request.params.admissionNumber.toUpperCase());
  if (!application) {
    response.status(404).json({ error: "Application not found." });
    return;
  }
  response.json({ application });
});

app.patch("/api/admin/applications/:admissionNumber/status", sameOrigin, requireAdmin, async (request, response) => {
  await updateStatus(request, response);
});

async function updateStatus(request, response) {
  const { status } = request.body || {};
  if (!validStatuses.has(status)) {
    response.status(400).json({ error: "Choose a valid application status." });
    return;
  }
  const admissionNumber = request.params.admissionNumber.toUpperCase();
  const rejectionReason = typeof request.body?.rejectionReason === "string"
    ? request.body.rejectionReason.trim()
    : "";
  if (status === "rejected" && (rejectionReason.length < 10 || rejectionReason.length > 1500)) {
    response.status(400).json({
      error: "Provide at least 10 characters explaining the rejection before notifying the student.",
    });
    return;
  }

  const update = await updateApplicationStatus(admissionNumber, status, rejectionReason);
  if (!update) {
    response.status(404).json({ error: "Application not found." });
    return;
  }

  let notification = update.rejectionEmailPreviouslySent
    ? { sent: true, reason: "already_sent" }
    : { sent: false, reason: "not_required" };
  if (update.rejectionEmailRequired) {
    const application = await findApplication(admissionNumber);
    try {
      if (!application.studentEmail) {
        notification = { sent: false, reason: "missing_student_email" };
      } else {
        notification = await sendRejectionNotice({
          admissionNumber,
          studentEmail: application.studentEmail,
          studentName: application.studentName,
          sex: application.sex,
          rejectionReason: application.rejectionReason,
        });
        if (notification.sent) {
          await markRejectionEmailSent(admissionNumber);
        }
      }
    } catch (error) {
      console.error(`Rejection email failed for ${admissionNumber}:`, error.message);
      notification = { sent: false, reason: "delivery_failed" };
    }
  }

  response.json({ admissionNumber, status, notification });
}

app.use("/api", (_request, response) => {
  response.status(404).json({ error: "API endpoint not found." });
});
app.use(express.static(publicDirectory, { dotfiles: "deny", index: "index.html" }));
app.use((_request, response) => {
  response.status(404).send("Page not found.");
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: "Please submit valid JSON." });
    return;
  }
  console.error("Unexpected request error:", error);
  response.status(500).json({ error: "An unexpected server error occurred." });
});

export { app };
export default app;

const isDirectRun = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  app.listen(port, () => {
    console.log(`Admissions portal listening on port ${port}.`);
  });
}
