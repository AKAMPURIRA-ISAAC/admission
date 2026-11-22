const databaseUrl = process.env.DATABASE_URL
  || process.env.POSTGRES_URL
  || process.env.SUPABASE_DATABASE_URL;

const implementation = databaseUrl
  ? await import("./db-postgres.js")
  : await import("./db-sqlite.js");

export const database = implementation.database;
export const createAdmin = (...args) => implementation.createAdmin(...args);
export const findAdminByUsername = (...args) => implementation.findAdminByUsername(...args);
export const saveSession = (...args) => implementation.saveSession(...args);
export const findSession = (...args) => implementation.findSession(...args);
export const deleteSession = (...args) => implementation.deleteSession(...args);
export const deleteExpiredSessions = (...args) => implementation.deleteExpiredSessions(...args);
export const createApplication = (...args) => implementation.createApplication(...args);
export const listApplications = (...args) => implementation.listApplications(...args);
export const findApplication = (...args) => implementation.findApplication(...args);
export const updateApplicationStatus = (...args) => implementation.updateApplicationStatus(...args);
export const markRejectionEmailSent = (...args) => implementation.markRejectionEmailSent(...args);
