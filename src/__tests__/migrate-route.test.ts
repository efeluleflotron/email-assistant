/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/migrate/route";
import { query } from "./helpers/db";

// ─── helpers ──────────────────────────────────────────────────────────────────

function req(body: object, secret = process.env.MIGRATE_SECRET) {
  return new NextRequest("http://localhost/api/admin/migrate", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function cleanDatabase() {
  await query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await query('DROP TABLE IF EXISTS "email_category" CASCADE');
  await query('DROP TABLE IF EXISTS "email" CASCADE');
  await query('DROP TABLE IF EXISTS "category" CASCADE');
  await query('DROP TABLE IF EXISTS "session" CASCADE');
  await query('DROP TABLE IF EXISTS "account" CASCADE');
  await query('DROP TABLE IF EXISTS "user" CASCADE');
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("POST /api/admin/migrate", () => {
  beforeEach(cleanDatabase);

  it("returns 503 when MIGRATE_SECRET is not configured", async () => {
    const saved = process.env.MIGRATE_SECRET;
    delete process.env.MIGRATE_SECRET;
    try {
      const res = await POST(req({}, "any"));
      expect(res.status).toBe(503);
    } finally {
      process.env.MIGRATE_SECRET = saved;
    }
  });

  it("returns 401 with wrong bearer token", async () => {
    const res = await POST(req({}, "wrong"));
    expect(res.status).toBe(401);
  });

  it("dry run reports pending migrations without touching the database", async () => {
    const res = await POST(req({ dryRun: true }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.dryRun).toBe(true);
    expect(body.pending).toEqual(["0000_core_tables", "0001_email_and_categories", "0002_gmail_history_id"]);
    expect(body.appliedCount).toBe(0);

    // The drizzle schema must not exist — dry run is a read-only operation.
    await expect(
      query("SELECT 1 FROM drizzle.__drizzle_migrations"),
    ).rejects.toThrow();
  });

  it("real run applies migrations and reports the ran list", async () => {
    const res = await POST(req({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ran).toEqual(["0000_core_tables", "0001_email_and_categories", "0002_gmail_history_id"]);

    const result = await query(
      "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
    );
    expect(result.rows[0].count).toBe(3);
  });

  it("real run called twice returns empty ran and keeps migration count at 1", async () => {
    await POST(req({}));

    const res = await POST(req({}));
    const body = await res.json();

    expect(body.ran).toEqual([]);

    const result = await query(
      "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
    );
    expect(result.rows[0].count).toBe(3);
  });
});
