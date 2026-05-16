/**
 * @jest-environment node
 *
 * Unit tests for the Gmail watch renewal cron handler. DB, gmail-watch, and
 * google-auth are all mocked so this runs without network or DB access.
 */

jest.mock("@/lib/gmail-watch", () => ({
  watchGmail: jest.fn(),
}));

jest.mock("@/lib/google-auth", () => ({
  getAccessToken: jest.fn(),
}));

jest.mock("@/db/client", () => {
  const selectWhere = jest.fn().mockResolvedValue([]);
  const selectFrom = jest.fn().mockReturnValue({ where: selectWhere });
  const select = jest.fn().mockReturnValue({ from: selectFrom });

  const updateWhere = jest.fn().mockResolvedValue([]);
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });

  return { db: { select, update }, pool: { end: jest.fn() } };
});

jest.mock("@/db/schema", () => ({
  accounts: {
    provider: "provider",
    providerAccountId: "providerAccountId",
    gmailWatchExpiration: "gmailWatchExpiration",
  },
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/renew-gmail-watch/route";
import { db } from "@/db/client";
import { watchGmail } from "@/lib/gmail-watch";
import { getAccessToken } from "@/lib/google-auth";

const SECRET = "test-secret";

function req(secret: string | null = SECRET): NextRequest {
  return new NextRequest("http://localhost/api/cron/renew-gmail-watch", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

function stubStaleAccounts(rows: object[]) {
  // The select chain: db.select().from().where() → resolves with rows
  const where = jest.fn().mockResolvedValue(rows);
  const from = jest.fn().mockReturnValue({ where });
  (db.select as jest.Mock).mockReturnValue({ from });
}

const ACCOUNT_A = {
  userId: "user-1",
  provider: "google",
  providerAccountId: "ga-1",
  access_token: "enc:tok",
  gmailHistoryId: "100",
  gmailWatchExpiration: null,
};

const ACCOUNT_B = {
  userId: "user-2",
  provider: "google",
  providerAccountId: "ga-2",
  access_token: "enc:tok2",
  gmailHistoryId: "200",
  gmailWatchExpiration: null,
};

const WATCH_RESPONSE = { historyId: "999", expiration: "1999999999000" };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  stubStaleAccounts([]);
  (getAccessToken as jest.Mock).mockResolvedValue("access-token");
  (watchGmail as jest.Mock).mockResolvedValue(WATCH_RESPONSE);
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("authentication", () => {
  it("returns 401 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(req(null));
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong bearer token", async () => {
    const res = await GET(req("wrong-secret"));
    expect(res.status).toBe(401);
  });
});

describe("renewal batch", () => {
  it("returns empty summary when no accounts are stale", async () => {
    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ renewed: 0, failed: 0, accounts: [] });
    expect(watchGmail).not.toHaveBeenCalled();
  });

  it("renews a stale account and persists new expiration and historyId", async () => {
    stubStaleAccounts([ACCOUNT_A]);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.renewed).toBe(1);
    expect(body.failed).toBe(0);
    expect(body.accounts).toEqual([{ providerAccountId: "ga-1", status: "renewed" }]);

    expect(getAccessToken).toHaveBeenCalledWith(ACCOUNT_A);
    expect(watchGmail).toHaveBeenCalledWith("access-token");
    expect(db.update).toHaveBeenCalled();
  });

  it("persists the new historyId and expiration from the watch response", async () => {
    stubStaleAccounts([ACCOUNT_A]);

    await GET(req());

    const setCall = (db.update as jest.Mock).mock.results[0].value.set.mock.calls[0][0];
    expect(setCall.gmailHistoryId).toBe("999");
    expect(setCall.gmailWatchExpiration).toBe(1999999999000);
  });

  it("marks an account as failed when getAccessToken throws", async () => {
    stubStaleAccounts([ACCOUNT_A]);
    (getAccessToken as jest.Mock).mockRejectedValueOnce(new Error("no refresh token"));

    const res = await GET(req());
    const body = await res.json();

    expect(body.renewed).toBe(0);
    expect(body.failed).toBe(1);
    expect(body.accounts[0]).toMatchObject({ providerAccountId: "ga-1", status: "failed" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("continues processing subsequent accounts after one fails", async () => {
    stubStaleAccounts([ACCOUNT_A, ACCOUNT_B]);
    (getAccessToken as jest.Mock)
      .mockRejectedValueOnce(new Error("token error"))
      .mockResolvedValueOnce("access-token-b");

    const res = await GET(req());
    const body = await res.json();

    expect(body.renewed).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.accounts).toEqual([
      { providerAccountId: "ga-1", status: "failed", error: "token error" },
      { providerAccountId: "ga-2", status: "renewed" },
    ]);
  });
});

describe("retry behaviour", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    stubStaleAccounts([ACCOUNT_A]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("retries watchGmail on transient failure and succeeds", async () => {
    (watchGmail as jest.Mock)
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(WATCH_RESPONSE);

    const promise = GET(req());
    await jest.runAllTimersAsync();
    const body = await (await promise).json();

    expect(watchGmail).toHaveBeenCalledTimes(2);
    expect(body.renewed).toBe(1);
    expect(body.failed).toBe(0);
  });

  it("marks account as failed after exhausting all retry attempts", async () => {
    (watchGmail as jest.Mock).mockRejectedValue(new Error("persistent failure"));

    const promise = GET(req());
    await jest.runAllTimersAsync();
    const body = await (await promise).json();

    expect(watchGmail).toHaveBeenCalledTimes(3);
    expect(body.renewed).toBe(0);
    expect(body.failed).toBe(1);
  });
});
