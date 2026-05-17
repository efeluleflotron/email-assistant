import { NextRequest, NextResponse, after } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { processGmailNotification } from "@/lib/email-fetcher";

export const runtime = "nodejs";

const authClient = new OAuth2Client();

type PubSubEnvelope = {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
};

type GmailNotification = {
  emailAddress?: string;
  historyId?: string;
};

function ack() {
  return new NextResponse(null, { status: 204 });
}

function unauthorized() {
  return new NextResponse(null, { status: 401 });
}

async function verifyPubSubToken(req: NextRequest): Promise<boolean> {
  const saEmail = process.env.GOOGLE_PUBSUB_SA_EMAIL;
  if (!saEmail) {
    console.error("[gmail-webhook] GOOGLE_PUBSUB_SA_EMAIL is not configured");
    return false;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.error("[gmail-webhook] missing or malformed Authorization header");
    return false;
  }

  const token = authHeader.slice(7);
  const base = process.env.NGROK_DOMAIN
    ? `https://${process.env.NGROK_DOMAIN}`
    : process.env.AUTH_URL;
  const audience = `${base}/api/webhooks/gmail`;

  try {
    const ticket = await authClient.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    if (!payload?.email_verified || payload.email !== saEmail) {
      console.error("[gmail-webhook] token email mismatch", {
        got: payload?.email,
        expected: saEmail
      });
      return false;
    }
    return true;
  } catch (err) {
    console.error("[gmail-webhook] token verification failed", err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyPubSubToken(req))) {
    return unauthorized();
  }

  let envelope: PubSubEnvelope;
  try {
    envelope = (await req.json()) as PubSubEnvelope;
  } catch (err) {
    console.error("[gmail-webhook] invalid JSON body", err);
    return ack();
  }

  const data = envelope.message?.data;
  if (typeof data !== "string") {
    console.error("[gmail-webhook] missing message.data", envelope);
    return ack();
  }

  let notification: GmailNotification;
  try {
    const decoded = Buffer.from(data, "base64").toString("utf8");
    notification = JSON.parse(decoded) as GmailNotification;
  } catch (err) {
    console.error("[gmail-webhook] failed to decode message.data", err);
    return ack();
  }

  console.log("[gmail-webhook]", {
    emailAddress: notification.emailAddress,
    historyId: notification.historyId,
    messageId: envelope.message?.messageId,
    publishTime: envelope.message?.publishTime,
    subscription: envelope.subscription
  });

  if (notification.emailAddress && notification.historyId) {
    after(
      processGmailNotification(
        notification.emailAddress,
        notification.historyId
      ).catch((err) =>
        console.error("[gmail-webhook] processGmailNotification failed", err)
      )
    );
  }

  return ack();
}
