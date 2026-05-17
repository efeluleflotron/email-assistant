import { NextRequest, NextResponse } from "next/server";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readFileSync } from "fs";
import path from "path";
import { query, db } from "@/db/client";

export const runtime = "nodejs";

type Journal = { entries: { idx: number; tag: string }[] };

export async function POST(req: NextRequest) {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "MIGRATE_SECRET is not configured" }, { status: 503 });
  }

  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;

  const migrationsFolder = path.join(process.cwd(), "src/db/migrations");
  const journal: Journal = JSON.parse(
    readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8")
  );

  let appliedCount = 0;
  try {
    const result = await query(
      "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations"
    );
    appliedCount = result.rows[0].count;
  } catch {
    // Table doesn't exist yet — all migrations are pending.
  }

  const pending = journal.entries.slice(appliedCount).map((e) => e.tag);

  if (dryRun) {
    return NextResponse.json({ dryRun: true, appliedCount, pending });
  }

  await migrate(db, { migrationsFolder });

  return NextResponse.json({ ran: pending });
}
