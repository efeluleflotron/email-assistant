/**
 * @jest-environment node
 *
 * Tests for the Gmail webhook endpoint's OIDC token verification. We mock
 * google-auth-library so these run without network access or real tokens.
 */

// jest.mock is hoisted above imports, so the factory cannot close over module-level
// variables. Instead we mock the class self-contained and retrieve the instance
// via jest.mocked() in beforeAll after the route module has loaded.
// email-fetcher imports googleapis (ESM-only), which can't be loaded without a
// proper mock in this test environment. Stub it so only auth logic is tested here.
jest.mock("@/lib/email-fetcher", () => ({
  processGmailNotification: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("next/server", () => ({
  ...jest.requireActual("next/server"),
  after: jest.fn((p: Promise<unknown>) => p.catch(() => {}))
}));

jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn()
  }))
}));

import { OAuth2Client } from "google-auth-library";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/webhooks/gmail/route";

const SA_EMAIL = "email-service@vast-verve-494300-j8.iam.gserviceaccount.com";

const VALID_PAYLOAD = {
  message: {
    data: Buffer.from(
      JSON.stringify({ emailAddress: "user@example.com", historyId: "12345" })
    ).toString("base64"),
    messageId: "msg-1",
    publishTime: "2026-05-13T00:00:00Z"
  },
  subscription: "projects/vast-verve-494300-j8/subscriptions/gmail-sub"
};

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/gmail", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
}

// The route instantiates `new OAuth2Client()` at module load. Retrieve that
// instance's verifyIdToken mock so tests can control its behavior.
let mockVerifyIdToken: jest.Mock;

beforeAll(() => {
  // mock.results[0].value is the object returned by the first constructor call
  mockVerifyIdToken = (
    jest.mocked(OAuth2Client).mock.results[0].value as { verifyIdToken: jest.Mock }
  ).verifyIdToken;
});

beforeEach(() => {
  mockVerifyIdToken.mockReset();
  process.env.GOOGLE_PUBSUB_SA_EMAIL = SA_EMAIL;
  process.env.AUTH_URL = "https://example.com";
});

afterEach(() => {
  delete process.env.GOOGLE_PUBSUB_SA_EMAIL;
  delete process.env.AUTH_URL;
});

function validTicket(email = SA_EMAIL) {
  return { getPayload: () => ({ email, email_verified: true }) };
}

describe("OIDC token verification", () => {
  it("returns 401 when GOOGLE_PUBSUB_SA_EMAIL is not configured", async () => {
    delete process.env.GOOGLE_PUBSUB_SA_EMAIL;
    const res = await POST(makeRequest(VALID_PAYLOAD, { Authorization: "Bearer tok" }));
    expect(res.status).toBe(401);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD));
    expect(res.status).toBe(401);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is not Bearer", async () => {
    const res = await POST(
      makeRequest(VALID_PAYLOAD, { Authorization: "Basic dXNlcjpwYXNz" })
    );
    expect(res.status).toBe(401);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it("returns 401 when verifyIdToken throws (invalid or expired token)", async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error("Token expired"));
    const res = await POST(makeRequest(VALID_PAYLOAD, { Authorization: "Bearer bad-token" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when token email does not match the expected service account", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        email: "other-sa@other-project.iam.gserviceaccount.com",
        email_verified: true
      })
    });
    const res = await POST(makeRequest(VALID_PAYLOAD, { Authorization: "Bearer tok" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when token email_verified is false", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: SA_EMAIL, email_verified: false })
    });
    const res = await POST(makeRequest(VALID_PAYLOAD, { Authorization: "Bearer tok" }));
    expect(res.status).toBe(401);
  });

  it("passes the correct audience to verifyIdToken", async () => {
    mockVerifyIdToken.mockResolvedValueOnce(validTicket());
    await POST(makeRequest(VALID_PAYLOAD, { Authorization: "Bearer tok" }));
    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: "tok",
      audience: "https://example.com/api/webhooks/gmail"
    });
  });
});

describe("payload handling (auth passes)", () => {
  beforeEach(() => {
    mockVerifyIdToken.mockResolvedValue(validTicket());
  });

  it("returns 204 for a valid Pub/Sub envelope", async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD, { Authorization: "Bearer tok" }));
    expect(res.status).toBe(204);
  });

  it("returns 204 for invalid JSON body (prevents Pub/Sub retry loop)", async () => {
    const req = new NextRequest("http://localhost/api/webhooks/gmail", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer tok" },
      body: "not-json"
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
  });

  it("returns 204 when message.data is missing", async () => {
    const res = await POST(
      makeRequest(
        { subscription: "projects/x/subscriptions/y" },
        { Authorization: "Bearer tok" }
      )
    );
    expect(res.status).toBe(204);
  });

  it("returns 204 when message.data is not valid base64 JSON", async () => {
    const res = await POST(
      makeRequest(
        { message: { data: "$$not-base64$$", messageId: "1" } },
        { Authorization: "Bearer tok" }
      )
    );
    expect(res.status).toBe(204);
  });
});
