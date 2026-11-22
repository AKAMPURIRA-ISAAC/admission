import { readFile, writeFile } from "node:fs/promises";

const writeSecrets = process.argv.includes("--write");

async function readEnvironmentFile(path) {
  try {
    const content = await readFile(path, "utf8");
    const environment = {};
    for (const line of content.split(/\r?\n/)) {
      const separator = line.indexOf("=");
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim();
      if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      environment[key] = value;
    }
    return environment;
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function firstPopulated(environment, names) {
  for (const name of names) {
    if (environment[name]?.trim()) return environment[name].trim();
  }
  return "";
}

function mask(value) {
  if (!value) return "(missing)";
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 3)}${"*".repeat(Math.min(12, value.length - 6))}${value.slice(-3)}`;
}

const environment = await readEnvironmentFile(".env");
const databaseUrl = firstPopulated(environment, [
  "DATABASE_URL",
  "POSTGRES_URL",
  "SUPABASE_DATABASE_URL",
]);
const vercelBaseUrl = firstPopulated(environment, [
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
  "PUBLIC_BASE_URL",
]);
const publicBaseUrl = vercelBaseUrl &&
  !/^https?:\/\/(?:localhost|127\.0\.0\.1)(?:[:/]|$)/i.test(vercelBaseUrl)
  ? vercelBaseUrl
  : "";

const variables = [
  ["NODE_ENV", "production"],
  ["TRUST_PROXY", "true"],
  ["DATABASE_URL", databaseUrl],
  ["PUBLIC_BASE_URL", publicBaseUrl],
  ["SMTP_HOST", environment.SMTP_HOST || ""],
  ["SMTP_PORT", environment.SMTP_PORT || "587"],
  ["SMTP_SECURE", environment.SMTP_SECURE || "false"],
  ["SMTP_USER", environment.SMTP_USER || ""],
  ["SMTP_PASS", environment.SMTP_PASS || ""],
  ["ADMISSIONS_EMAIL_FROM", environment.ADMISSIONS_EMAIL_FROM || ""],
  ["ADMISSIONS_EMAIL_TO", environment.ADMISSIONS_EMAIL_TO || ""],
];

console.log("Vercel deployment environment");
for (const [name, value] of variables) {
  const source = name === "NODE_ENV" || name === "TRUST_PROXY"
    ? "auto"
    : databaseUrl && name === "DATABASE_URL"
      ? "detected"
      : environment[name]?.trim()
        ? "detected"
        : "missing";
  console.log(`${name}: ${source === "missing" ? "missing" : source === "auto" ? value : mask(value)}`);
}

if (writeSecrets) {
  const file = variables
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n");
  await writeFile(".vercel.env", `${file}\n`, "utf8");
  console.log("\nWrote detected values to .vercel.env.");
  console.log("This file contains secrets and is ignored by Git.");
}
