import { migrateSQLiteToPostgres, pool } from "../src/db-postgres.js";

async function main() {
  try {
    const result = await migrateSQLiteToPostgres();
    console.log(
      `Migration complete: ${result.applications} applications and ${result.admins} admin accounts copied.`,
    );
    console.log("Existing admin sessions were not copied; admins must sign in again.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`SQLite to PostgreSQL migration failed: ${error.message}`);
  process.exitCode = 1;
});
