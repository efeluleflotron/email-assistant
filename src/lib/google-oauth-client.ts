import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";

export class GoogleAccountNotConnectedError extends Error {
  constructor() {
    super("Google account not linked or refresh token missing");
    this.name = "GoogleAccountNotConnectedError";
  }
}

export async function getGoogleOAuth2ClientForUser(
  userId: string,
): Promise<OAuth2Client> {
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")))
    .limit(1);

  const row = rows[0];
  if (!row || !row.refresh_token) {
    throw new GoogleAccountNotConnectedError();
  }

  const refreshToken = decrypt(row.refresh_token);
  const accessToken = row.access_token ? decrypt(row.access_token) : undefined;

  const client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  );

  client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken,
    expiry_date: row.expires_at ? row.expires_at * 1000 : undefined,
  });

  client.on("tokens", (tokens) => {
    void persistRefreshedTokens(userId, tokens);
  });

  return client;
}

async function persistRefreshedTokens(
  userId: string,
  tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null },
): Promise<void> {
  try {
    const updates: Partial<typeof accounts.$inferInsert> = {};
    if (tokens.access_token) {
      updates.access_token = encrypt(tokens.access_token);
    }
    if (tokens.refresh_token) {
      updates.refresh_token = encrypt(tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      updates.expires_at = Math.floor(tokens.expiry_date / 1000);
    }
    if (Object.keys(updates).length === 0) return;

    await db
      .update(accounts)
      .set(updates)
      .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")));
  } catch (err) {
    console.error("Failed to persist refreshed Google tokens", err);
  }
}
