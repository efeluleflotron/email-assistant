import { config } from "dotenv";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

config({ path: ".env.local" });
config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("migrations applied");
} finally {
  await client.end();
}
