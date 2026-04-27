/**
 * Shared test database utilities.
 * Importing this module automatically registers afterAll pool cleanup —
 * test files never need to manage connection lifecycle themselves.
 */

import { afterAll } from "@jest/globals";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { pool } from "@/db/client";

export { pool, db, query } from "@/db/client";

const MIGRATIONS = path.join(process.cwd(), "src/db/migrations");

export async function runMigrations() {
  const client = new Client({ connectionString: process.env.DATABASE_URL! });
  await client.connect();
  try {
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS });
  } finally {
    await client.end();
  }
}

afterAll(() => pool.end());
