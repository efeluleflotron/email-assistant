/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/gmail/webhook/route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/gmail/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const b64 = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString("base64");

describe("POST /api/gmail/webhook", () => {
  let savedFlag: string | undefined;

  beforeEach(() => {
    savedFlag = process.env.GMAIL_WEBHOOK_ENABLED;
    process.env.GMAIL_WEBHOOK_ENABLED = "true";
  });

  afterEach(() => {
    if (savedFlag === undefined) {
      delete process.env.GMAIL_WEBHOOK_ENABLED;
    } else {
      process.env.GMAIL_WEBHOOK_ENABLED = savedFlag;
    }
  });

  it("returns 404 when GMAIL_WEBHOOK_ENABLED is not 'true'", async () => {
    delete process.env.GMAIL_WEBHOOK_ENABLED;
    const res = await POST(req({ message: { data: b64({ x: 1 }) } }));
    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid JSON body", async () => {
    const res = await POST(req("{not json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when message.data is missing", async () => {
    const res = await POST(req({ message: {} }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when data is not valid base64-encoded JSON", async () => {
    const res = await POST(req({ message: { data: "!!!not-base64!!!" } }));
    expect(res.status).toBe(400);
  });

  it("returns 204 on a valid envelope and logs the decoded payload", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      const res = await POST(
        req({
          message: {
            data: b64({ emailAddress: "u@example.com", historyId: "42" }),
            messageId: "msg-1",
            publishTime: "2026-05-01T00:00:00Z",
          },
          subscription: "projects/p/subscriptions/s",
        }),
      );

      expect(res.status).toBe(204);
      expect(spy).toHaveBeenCalledWith(
        "[gmail-webhook]",
        expect.objectContaining({
          emailAddress: "u@example.com",
          historyId: "42",
          messageId: "msg-1",
          subscription: "projects/p/subscriptions/s",
        }),
      );
    } finally {
      spy.mockRestore();
    }
  });
});
