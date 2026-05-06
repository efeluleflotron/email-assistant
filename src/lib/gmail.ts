import type { gmail_v1 } from "googleapis";
import { google } from "googleapis";
import { unstable_cache } from "next/cache";
import { getGoogleOAuth2ClientForUser } from "@/lib/google-oauth-client";

export interface RecentMessageMetadata {
  id: string;
  from: string;
  subject: string;
  date: string;
}

export interface FullMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
}

const METADATA_HEADERS = ["From", "Subject", "Date"];
const FULL_HEADERS = ["From", "To", "Subject", "Date"];

export async function listRecentMessageMetadata(
  userId: string,
  max: number = 10,
): Promise<RecentMessageMetadata[]> {
  const auth = await getGoogleOAuth2ClientForUser(userId);
  const gmail = google.gmail({ version: "v1", auth });

  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: max,
  });

  const ids =
    list.data.messages
      ?.map((m) => m.id)
      .filter((id): id is string => typeof id === "string") ?? [];
  if (ids.length === 0) return [];

  const messages = await Promise.all(
    ids.map((id) =>
      gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: METADATA_HEADERS,
      }),
    ),
  );

  return messages.map((res, i) => {
    const headers = res.data.payload?.headers ?? [];
    return {
      id: ids[i],
      from: findHeader(headers, "From"),
      subject: findHeader(headers, "Subject"),
      date: findHeader(headers, "Date"),
    };
  });
}

export async function getMessage(
  userId: string,
  id: string,
): Promise<FullMessage> {
  const auth = await getGoogleOAuth2ClientForUser(userId);
  const gmail = google.gmail({ version: "v1", auth });

  const res = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
    metadataHeaders: FULL_HEADERS,
  });

  const headers = res.data.payload?.headers ?? [];
  const body = extractBody(res.data.payload ?? null);

  return {
    id,
    from: findHeader(headers, "From"),
    to: findHeader(headers, "To"),
    subject: findHeader(headers, "Subject"),
    date: findHeader(headers, "Date"),
    body,
  };
}

export interface StartWatchResult {
  historyId: string;
  expiration: number;
}

export async function startGmailWatch(
  userId: string,
  topicName: string,
): Promise<StartWatchResult> {
  const auth = await getGoogleOAuth2ClientForUser(userId);
  const gmail = google.gmail({ version: "v1", auth });

  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName,
      labelIds: ["INBOX"],
      labelFilterBehavior: "INCLUDE",
    },
  });

  const historyId = res.data.historyId;
  const expiration = res.data.expiration;
  if (!historyId || !expiration) {
    throw new Error("Gmail watch response missing historyId or expiration");
  }

  return { historyId, expiration: Number(expiration) };
}

export const getCachedList = unstable_cache(
  (userId: string) => listRecentMessageMetadata(userId, 10),
  ["gmail-list-v1"],
  { revalidate: 60 },
);

export const getCachedMessage = unstable_cache(
  (userId: string, id: string) => getMessage(userId, id),
  ["gmail-message-v1"],
  { revalidate: 300 },
);

function findHeader(
  headers: { name?: string | null; value?: string | null }[],
  name: string,
): string {
  const lower = name.toLowerCase();
  for (const h of headers) {
    if (h.name?.toLowerCase() === lower && h.value) return h.value;
  }
  return "";
}

function extractBody(payload: gmail_v1.Schema$MessagePart | null): string {
  if (!payload) return "";
  const plain = findPart(payload, "text/plain");
  if (plain) return decodeBody(plain).trim();
  const html = findPart(payload, "text/html");
  if (html) return stripHtml(decodeBody(html)).trim();
  return "";
}

function findPart(
  part: gmail_v1.Schema$MessagePart,
  mimeType: string,
): gmail_v1.Schema$MessagePart | null {
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const hit = findPart(child, mimeType);
    if (hit) return hit;
  }
  return null;
}

function decodeBody(part: gmail_v1.Schema$MessagePart): string {
  const data = part.body?.data;
  if (!data) return "";
  return Buffer.from(data, "base64url").toString("utf8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}
