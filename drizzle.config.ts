import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// Next.js auto-loads .env.local, but drizzle-kit runs outside that pipeline.
config({ path: ".env.local" });
config({ path: ".env" });

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
} satisfies Config;
