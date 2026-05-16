import { NextRequest, NextResponse } from "next/server";
import { eq, and, or, isNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";
import { watchGmail } from "@/lib/gmail-watch";
import { getAccessToken } from "@/lib/google-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }
  throw new Error("withRetry: exhausted attempts");
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const threshold = Date.now() + FORTY_EIGHT_HOURS_MS;

  const stale = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.provider, "google"),
        or(
          isNull(accounts.gmailWatchExpiration),
          lt(accounts.gmailWatchExpiration, threshold),
        ),
      ),
    );

  let renewed = 0;
  let failed = 0;
  const results: { providerAccountId: string; status: "renewed" | "failed"; error?: string }[] = [];

  for (const account of stale) {
    try {
      const accessToken = await getAccessToken(account);
      const watch = await withRetry(() => watchGmail(accessToken));

      await db
        .update(accounts)
        .set({
          gmailHistoryId: watch.historyId ? String(watch.historyId) : account.gmailHistoryId,
          gmailWatchExpiration: watch.expiration ? Number(watch.expiration) : undefined,
        })
        .where(
          and(
            eq(accounts.provider, account.provider),
            eq(accounts.providerAccountId, account.providerAccountId),
          ),
        );

      console.log("[cron/renew-gmail-watch] renewed", {
        providerAccountId: account.providerAccountId,
        expiration: watch.expiration,
      });

      renewed++;
      results.push({ providerAccountId: account.providerAccountId, status: "renewed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      console.error("[cron/renew-gmail-watch] gmail_watch_renewal_failed", {
        providerAccountId: account.providerAccountId,
        err,
      });

      failed++;
      results.push({ providerAccountId: account.providerAccountId, status: "failed", error: message });
    }
  }

  return NextResponse.json({ renewed, failed, accounts: results });
}
