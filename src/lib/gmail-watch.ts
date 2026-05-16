import { google, type gmail_v1 } from "googleapis";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";

export type GmailWatchResponse = gmail_v1.Schema$WatchResponse;

/**
 * Arms a Gmail push notification on the user's INBOX. Gmail will publish to
 * the topic configured in `GOOGLE_PUBSUB_TOPIC` whenever the inbox changes.
 * The watch expires after 7 days and must be renewed.
 */
export async function watchGmail(accessToken: string): Promise<GmailWatchResponse> {
  const topicName = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!topicName) {
    throw new Error("GOOGLE_PUBSUB_TOPIC is not configured");
  }

  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      labelIds: ["INBOX"],
      topicName
    }
  });

  return res.data;
}

/**
 * Fire-and-forget variant of `watchGmail`. Logs success/failure so callers
 * inside auth flows don't have to manage promise lifecycle. Intended for use
 * in NextAuth adapter callbacks where we want to attach a watch without
 * blocking the OAuth response.
 */
export function dispatchGmailWatch(
  accessToken: string,
  ctx: { userId: string; provider: string; providerAccountId: string }
): void {
  if (process.env.NODE_ENV === "test") return;

  watchGmail(accessToken)
    .then(async (watch) => {
      console.log("[gmail-watch] subscribed", {
        userId: ctx.userId,
        historyId: watch.historyId,
        expiration: watch.expiration
      });

      if (watch.historyId) {
        await db
          .update(accounts)
          .set({
            gmailHistoryId: String(watch.historyId),
            gmailWatchExpiration: watch.expiration ? Number(watch.expiration) : undefined,
          })
          .where(
            and(
              eq(accounts.provider, ctx.provider),
              eq(accounts.providerAccountId, ctx.providerAccountId)
            )
          );
      }
    })
    .catch((err) => {
      console.error("[gmail-watch] failed to subscribe", {
        userId: ctx.userId,
        err
      });
    });
}
