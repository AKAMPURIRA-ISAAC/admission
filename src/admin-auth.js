import { createHash, randomBytes } from "node:crypto";
import { deleteSession, findSession, saveSession } from "./db.js";

export const sessionCookieName = "hh_admin_session";
const sessionDurationMs = 8 * 60 * 60 * 1000;

export function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAdminSession(adminId) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + sessionDurationMs).toISOString();
  await saveSession({ tokenHash, adminId, expiresAt });
  return { token, expiresAt };
}

export function readSessionToken(request) {
  const cookieHeader = request.headers.cookie || "";
  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== sessionCookieName) {
      continue;
    }
    const value = cookie.slice(separator + 1).trim();
    return /^[A-Za-z0-9_-]{40,50}$/.test(value) ? value : null;
  }
  return null;
}

export async function requireAdmin(request, response, next) {
  const token = readSessionToken(request);
  const admin = token ? await findSession(hashSessionToken(token)) : null;
  if (!admin) {
    response.status(401).json({ error: "Please sign in to access the admin portal." });
    return;
  }
  request.admin = admin;
  request.sessionToken = token;
  next();
}

export async function endAdminSession(request) {
  if (request.sessionToken) {
    await deleteSession(hashSessionToken(request.sessionToken));
  }
}

export function sessionCookieOptions() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionDurationMs / 1000}${secure}`;
}

export function expiredSessionCookieOptions() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export async function getAdminBySession(request) {
  const token = readSessionToken(request);
  return token ? await findSession(hashSessionToken(token)) : null;
}

export function persistSession(adminId) {
  return createAdminSession(adminId);
}
