import { Pool, Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const DB_URL = process.env.DATABASE_URL;

// Persistent pool — used by Drizzle ORM and the adapter.
export const pool = new Pool({ connectionString: DB_URL });
export const db = drizzle(pool, { schema });

// One-shot raw SQL helper. Opens a client, runs the query, closes it.
// Use this anywhere you need raw SQL without managing connection lifecycle.
export async function query(text: string, values?: unknown[]) {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return await client.query(text, values);
  } finally {
    await client.end();
  }
}
