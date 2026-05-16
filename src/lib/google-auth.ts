import { google } from "googleapis";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";

export async function getAccessToken(
  account: typeof accounts.$inferSelect,
): Promise<string> {
  const plainAccessToken = decrypt(account.access_token!);

  const now = Math.floor(Date.now() / 1000);
  const BUFFER = 5 * 60;

  if (account.expires_at && account.expires_at > now + BUFFER) {
    return plainAccessToken;
  }

  if (!account.refresh_token) {
    throw new Error("access token expired and no refresh token available");
  }

  const plainRefreshToken = decrypt(account.refresh_token);

  const oauth2 = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  );
  oauth2.setCredentials({
    access_token: plainAccessToken,
    refresh_token: plainRefreshToken,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  const { token, res } = await oauth2.getAccessToken();
  if (!token) throw new Error("token refresh returned no access token");

  const newExpiresAt = res?.data?.expiry_date
    ? Math.floor((res.data.expiry_date as number) / 1000)
    : null;

  await db
    .update(accounts)
    .set({
      access_token: encrypt(token),
      ...(newExpiresAt !== null ? { expires_at: newExpiresAt } : {}),
    })
    .where(
      and(
        eq(accounts.provider, account.provider),
        eq(accounts.providerAccountId, account.providerAccountId),
      ),
    );

  return token;
}
