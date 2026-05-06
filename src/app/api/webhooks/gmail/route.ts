import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

export async function POST(req: NextRequest) {
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
    subscription: envelope.subscription,
  });

  return ack();
}
