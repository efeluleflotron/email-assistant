import { google, type gmail_v1 } from "googleapis";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { users, accounts, emails } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { watchGmail } from "@/lib/gmail-watch";
import { getAccessToken } from "@/lib/google-auth";

export async function processGmailNotification(
  emailAddress: string,
  historyId: string,
): Promise<void> {
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, emailAddress),
  });

  if (!user) {
    console.warn("[email-fetcher] unknown email address", { emailAddress });
    return;
  }

  const account = await db.query.accounts.findFirst({
    where: (a, { eq, and }) =>
      and(eq(a.userId, user.id), eq(a.provider, "google")),
  });

  if (!account?.access_token) {
    console.warn("[email-fetcher] no google account for user", {
      userId: user.id,
    });
    return;
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(account);
  } catch (err) {
    console.error("[email-fetcher] failed to get access token", {
      userId: user.id,
      err,
    });
    return;
  }

  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  let messageIds: string[];
  try {
    // Use the stored historyId from watch() as startHistoryId. The notification's
    // historyId is the current mailbox state, not the specific change event — using
    // it directly would skip messages recorded at lower history IDs.
    if (!account.gmailHistoryId) {
      // First notification after the gmailHistoryId column was added — bootstrap
      // by re-calling watch() which returns the current historyId as a baseline.
      const watch = await watchGmail(accessToken);
      if (watch.historyId) {
        await db
          .update(accounts)
          .set({ gmailHistoryId: String(watch.historyId) })
          .where(
            and(
              eq(accounts.provider, account.provider),
              eq(accounts.providerAccountId, account.providerAccountId),
            ),
          );
      }
      console.log("[email-fetcher] bootstrapped gmailHistoryId, send another email to test", {
        userId: user.id,
        gmailHistoryId: watch.historyId,
      });
      return;
    }
    const historyRes = await gmail.users.history.list({
      userId: "me",
      startHistoryId: account.gmailHistoryId,
      historyTypes: ["messageAdded"],
    });

    const historyItems = historyRes.data.history ?? [];
    messageIds = historyItems
      .flatMap((h) => h.messagesAdded ?? [])
      .map((m) => m.message?.id)
      .filter((id): id is string => !!id);
  } catch (err) {
    console.error("[email-fetcher] history.list failed", {
      userId: user.id,
      err,
    });
    return;
  }

  // Advance the cursor regardless of whether there are new messages.
  await db
    .update(accounts)
    .set({ gmailHistoryId: historyId })
    .where(
      and(
        eq(accounts.provider, account.provider),
        eq(accounts.providerAccountId, account.providerAccountId),
      ),
    );

  if (messageIds.length === 0) return;

  for (const messageId of messageIds) {
    try {
      const msgRes = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      const msg = msgRes.data;
      const headers = msg.payload?.headers ?? [];

      const getHeader = (name: string) =>
        headers.find(
          (h) => h.name?.toLowerCase() === name.toLowerCase(),
        )?.value ?? null;

      const from = getHeader("From");
      const to = getHeader("To");
      const subject = getHeader("Subject");
      const dateStr = getHeader("Date");
      const receivedAt = dateStr ? new Date(dateStr) : null;
      const body = extractBody(msg.payload);

      await db
        .insert(emails)
        .values({
          userId: user.id,
          gmailMessageId: messageId,
          gmailThreadId: msg.threadId ?? null,
          fromEncrypted: encrypt(from ?? ""),
          toEncrypted: to ? encrypt(to) : null,
          subjectEncrypted: subject ? encrypt(subject) : null,
          bodyEncrypted: body ? encrypt(body) : null,
          receivedAt,
        })
        .onConflictDoNothing();

      console.log("[email-fetcher] stored message", {
        userId: user.id,
        messageId,
      });
    } catch (err) {
      console.error("[email-fetcher] failed to store message", {
        userId: user.id,
        messageId,
        err,
      });
    }
  }
}

function extractBody(
  payload: gmail_v1.Schema$MessagePart | undefined | null,
): string | null {
  if (!payload) return null;

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf8");
  }

  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, "base64url").toString("utf8");
    }
    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return Buffer.from(htmlPart.body.data, "base64url").toString("utf8");
    }
    for (const part of payload.parts) {
      const body = extractBody(part);
      if (body) return body;
    }
  }

  return null;
}
