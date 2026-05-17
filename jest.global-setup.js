/**
 * Jest global setup — runs once before any test suite in a separate process.
 * Drops all application tables and the Drizzle migration-tracking schema so
 * every test run starts from a clean, known state. Individual test suites are
 * responsible for re-applying migrations via runMigrations().
 */
const dotenv = require("dotenv");
dotenv.config({ path: ".env.test" });

module.exports = async function globalSetup() {
  const { Client } = require("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // Drop in dependency order so FK constraints don't block us.
    await client.query("DROP TABLE IF EXISTS \"email_category\" CASCADE");
    await client.query("DROP TABLE IF EXISTS \"email\" CASCADE");
    await client.query("DROP TABLE IF EXISTS \"category\" CASCADE");
    await client.query("DROP TABLE IF EXISTS \"session\" CASCADE");
    await client.query("DROP TABLE IF EXISTS \"account\" CASCADE");
    await client.query("DROP TABLE IF EXISTS \"user\" CASCADE");
    await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  } finally {
    await client.end();
  }
};
