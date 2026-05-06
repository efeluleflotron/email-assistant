import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface PubSubEnvelope {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
    attributes?: Record<string, string>;
  };
  subscription?: string;
}

interface GmailPushPayload {
  emailAddress: string;
  historyId: string | number;
}

export async function POST(req: NextRequest) {
  if (process.env.GMAIL_WEBHOOK_ENABLED !== "true") {
    return new NextResponse(null, { status: 404 });
  }

  let envelope: PubSubEnvelope;
  try {
    envelope = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const data = envelope.message?.data;
  if (!data) {
    return NextResponse.json(
      { error: "missing message.data" },
      { status: 400 },
    );
  }

  let payload: GmailPushPayload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  console.log("[gmail-webhook]", {
    messageId: envelope.message?.messageId,
    publishTime: envelope.message?.publishTime,
    subscription: envelope.subscription,
    emailAddress: payload.emailAddress,
    historyId: payload.historyId,
  });

  // TODO: layer on OIDC verification, then look up the user by
  // payload.emailAddress, fetch gmail.users.history.list, process
  // new message IDs, and persist the new historyId.

  return new NextResponse(null, { status: 204 });
}
