/**
 * @jest-environment node
 *
 * Unit tests for getAccessToken. All external dependencies are mocked.
 */

jest.mock("googleapis", () => {
  const getAccessToken = jest.fn();
  const setCredentials = jest.fn();
  const OAuth2 = jest.fn().mockImplementation(() => ({ setCredentials, getAccessToken }));
  return { google: { auth: { OAuth2 } } };
});

jest.mock("@/lib/crypto", () => ({
  encrypt: jest.fn((s: string) => `enc:${s}`),
  decrypt: jest.fn((s: string) => (s.startsWith("enc:") ? s.slice(4) : s)),
}));

jest.mock("@/db/client", () => {
  const where = jest.fn().mockResolvedValue([]);
  const set = jest.fn().mockReturnValue({ where });
  const update = jest.fn().mockReturnValue({ set });
  return { db: { update }, pool: { end: jest.fn() } };
});

jest.mock("@/db/schema", () => ({
  accounts: { provider: "provider", providerAccountId: "providerAccountId" },
}));

import { google } from "googleapis";
import { db } from "@/db/client";
import { getAccessToken } from "@/lib/google-auth";

const NOW_S = Math.floor(Date.now() / 1000);

const BASE_ACCOUNT = {
  userId: "user-1",
  type: "oauth" as const,
  provider: "google",
  providerAccountId: "ga-1",
  access_token: "enc:access",
  refresh_token: "enc:refresh",
  expires_at: NOW_S + 3600,
  token_type: null,
  scope: null,
  id_token: null,
  session_state: null,
  gmailHistoryId: null,
  gmailWatchExpiration: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getAccessToken", () => {
  it("returns the decrypted access token when it is not expired", async () => {
    const token = await getAccessToken(BASE_ACCOUNT);

    expect(token).toBe("access");
    expect(google.auth.OAuth2).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("refreshes the token when expires_at is in the past", async () => {
    const expiredAccount = { ...BASE_ACCOUNT, expires_at: NOW_S - 60 };
    const newExpiry = (NOW_S + 3600) * 1000;

    const oauth2Instance = (google.auth.OAuth2 as unknown as jest.Mock).mock.results[0]?.value ?? {
      setCredentials: jest.fn(),
      getAccessToken: jest.fn(),
    };

    (google.auth.OAuth2 as unknown as jest.Mock).mockImplementationOnce(() => ({
      setCredentials: jest.fn(),
      getAccessToken: jest.fn().mockResolvedValue({
        token: "new-access",
        res: { data: { expiry_date: newExpiry } },
      }),
    }));

    const token = await getAccessToken(expiredAccount);

    expect(token).toBe("new-access");
    expect(db.update).toHaveBeenCalled();
  });

  it("refreshes when expires_at is null (unknown expiry)", async () => {
    const noExpiryAccount = { ...BASE_ACCOUNT, expires_at: null };

    (google.auth.OAuth2 as unknown as jest.Mock).mockImplementationOnce(() => ({
      setCredentials: jest.fn(),
      getAccessToken: jest.fn().mockResolvedValue({
        token: "new-access",
        res: { data: { expiry_date: null } },
      }),
    }));

    const token = await getAccessToken(noExpiryAccount);

    expect(token).toBe("new-access");
  });

  it("throws when the token is expired and no refresh_token is available", async () => {
    const noRefreshAccount = {
      ...BASE_ACCOUNT,
      expires_at: NOW_S - 60,
      refresh_token: null,
    };

    await expect(getAccessToken(noRefreshAccount)).rejects.toThrow(
      "access token expired and no refresh token available",
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it("throws when OAuth2 returns no token", async () => {
    const expiredAccount = { ...BASE_ACCOUNT, expires_at: NOW_S - 60 };

    (google.auth.OAuth2 as unknown as jest.Mock).mockImplementationOnce(() => ({
      setCredentials: jest.fn(),
      getAccessToken: jest.fn().mockResolvedValue({ token: null, res: null }),
    }));

    await expect(getAccessToken(expiredAccount)).rejects.toThrow(
      "token refresh returned no access token",
    );
    expect(db.update).not.toHaveBeenCalled();
  });
});
