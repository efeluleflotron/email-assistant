/**
 * @jest-environment node
 *
 * Unit tests for processGmailNotification. All external dependencies (Gmail
 * API, database, crypto) are mocked so this runs without network or DB access.
 */

// ── googleapis mock ─────────────────────────────────────────────────────────
// Defined inside the factory so they're available before imports are evaluated.
jest.mock("googleapis", () => {
  const historyList = jest.fn();
  const messagesGet = jest.fn();
  const setCredentials = jest.fn();
  const getAccessToken = jest.fn();
  const OAuth2 = jest.fn().mockImplementation(() => ({
    setCredentials,
    getAccessToken
  }));

  return {
    google: {
      auth: { OAuth2 },
      gmail: jest.fn().mockReturnValue({
        users: {
          history: { list: historyList },
          messages: { get: messagesGet }
        }
      })
    }
  };
});

// ── crypto mock ──────────────────────────────────────────────────────────────
jest.mock("@/lib/crypto", () => ({
  encrypt: jest.fn((s: string) => `enc:${s}`),
  decrypt: jest.fn((s: string) =>
    s.startsWith("enc:") ? s.slice(4) : s
  )
}));

// ── DB mock ──────────────────────────────────────────────────────────────────
jest.mock("@/db/client", () => {
  const onConflictDoNothing = jest.fn().mockResolvedValue([]);
  const values = jest.fn().mockReturnValue({ onConflictDoNothing });
  const insert = jest.fn().mockReturnValue({ values });

  const where = jest.fn().mockResolvedValue([]);
  const set = jest.fn().mockReturnValue({ where });
  const update = jest.fn().mockReturnValue({ set });

  const findFirstUser = jest.fn();
  const findFirstAccount = jest.fn();

  return {
    db: {
      query: {
        users: { findFirst: findFirstUser },
        accounts: { findFirst: findFirstAccount }
      },
      insert,
      update
    },
    pool: { end: jest.fn() }
  };
});

// ── gmail-watch mock ─────────────────────────────────────────────────────────
jest.mock("@/lib/gmail-watch", () => ({
  watchGmail: jest.fn().mockResolvedValue({ historyId: "99999" })
}));

// ── schema mock — only needed so drizzle helpers resolve symbols ─────────────
jest.mock("@/db/schema", () => ({
  users: {},
  accounts: { userId: "userId", provider: "provider", providerAccountId: "providerAccountId" },
  emails: {}
}));

import { processGmailNotification } from "@/lib/email-fetcher";
import { google } from "googleapis";
import { db } from "@/db/client";

// ── helpers ──────────────────────────────────────────────────────────────────
function getMocks() {
  const gmailInstance = (google.gmail as jest.Mock).mock.results[0]?.value ?? {
    users: {
      history: { list: jest.fn() },
      messages: { get: jest.fn() }
    }
  };
  // Re-fetch after each gmail() call
  const latestGmail = () => {
    const calls = (google.gmail as jest.Mock).mock.results;
    return calls.length > 0
      ? calls[calls.length - 1].value
      : gmailInstance;
  };

  const OAuth2Instance = (google.auth.OAuth2 as unknown as jest.Mock).mock.results[0]?.value;

  return {
    historyList: () => latestGmail().users.history.list as jest.Mock,
    messagesGet: () => latestGmail().users.messages.get as jest.Mock,
    oauth2SetCredentials: OAuth2Instance?.setCredentials as jest.Mock,
    oauth2GetAccessToken: OAuth2Instance?.getAccessToken as jest.Mock,
    dbInsert: db.insert as jest.Mock,
    dbUpdate: db.update as jest.Mock,
    findUser: db.query.users.findFirst as jest.Mock,
    findAccount: db.query.accounts.findFirst as jest.Mock
  };
}

const VALID_USER = { id: "user-1", email: "test@example.com" };
const VALID_ACCOUNT = {
  userId: "user-1",
  provider: "google",
  providerAccountId: "ga-1",
  access_token: "enc:valid-token",
  refresh_token: "enc:refresh-token",
  expires_at: Math.floor(Date.now() / 1000) + 3600, // valid for 1 hour
  gmailHistoryId: "12345"
};

function makeMessage(id: string) {
  return {
    data: {
      id,
      threadId: `thread-${id}`,
      payload: {
        headers: [
          { name: "From", value: "sender@example.com" },
          { name: "To", value: "me@example.com" },
          { name: "Subject", value: "Hello world" },
          { name: "Date", value: "Mon, 13 May 2026 12:00:00 +0000" }
        ],
        body: {
          data: Buffer.from("Email body text").toString("base64url")
        }
      }
    }
  };
}

function makeHistoryResponse(messageIds: string[]) {
  return {
    data: {
      history: messageIds.map((id) => ({
        messagesAdded: [{ message: { id } }]
      }))
    }
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Re-initialize google.gmail mock so each test gets a fresh instance
  (google.gmail as jest.Mock).mockReturnValue({
    users: {
      history: { list: jest.fn() },
      messages: { get: jest.fn() }
    }
  });
});

// ── tests ────────────────────────────────────────────────────────────────────
describe("processGmailNotification", () => {
  it("returns early when email address is not in the database", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue(undefined);

    await expect(
      processGmailNotification("nobody@example.com", "12345")
    ).resolves.toBeUndefined();

    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns early when the user has no google account", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue(VALID_USER);
    (db.query.accounts.findFirst as jest.Mock).mockResolvedValue(undefined);

    await expect(
      processGmailNotification("test@example.com", "12345")
    ).resolves.toBeUndefined();

    expect(db.insert).not.toHaveBeenCalled();
  });

  it("does not insert anything when history contains no new messages", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue(VALID_USER);
    (db.query.accounts.findFirst as jest.Mock).mockResolvedValue(VALID_ACCOUNT);

    const gmail = google.gmail({ version: "v1" });
    (gmail.users.history.list as jest.Mock).mockResolvedValue({
      data: { history: [] }
    });

    await processGmailNotification("test@example.com", "12345");

    expect(db.insert).not.toHaveBeenCalled();
  });

  it("fetches and stores each new message with encrypted fields", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue(VALID_USER);
    (db.query.accounts.findFirst as jest.Mock).mockResolvedValue(VALID_ACCOUNT);

    const gmail = google.gmail({ version: "v1" });
    (gmail.users.history.list as jest.Mock).mockResolvedValue(
      makeHistoryResponse(["msg-1", "msg-2"])
    );
    (gmail.users.messages.get as jest.Mock)
      .mockResolvedValueOnce(makeMessage("msg-1"))
      .mockResolvedValueOnce(makeMessage("msg-2"));

    await processGmailNotification("test@example.com", "12345");

    expect(gmail.users.messages.get).toHaveBeenCalledTimes(2);
    expect(db.insert).toHaveBeenCalledTimes(2);

    // Verify the values contain encrypted fields
    const firstCallValues = (db.insert as jest.Mock).mock.results[0].value
      .values.mock.calls[0][0];
    expect(firstCallValues.fromEncrypted).toBe("enc:sender@example.com");
    expect(firstCallValues.subjectEncrypted).toBe("enc:Hello world");
    expect(firstCallValues.userId).toBe("user-1");
  });

  it("continues storing other messages when one fails", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue(VALID_USER);
    (db.query.accounts.findFirst as jest.Mock).mockResolvedValue(VALID_ACCOUNT);

    const gmail = google.gmail({ version: "v1" });
    (gmail.users.history.list as jest.Mock).mockResolvedValue(
      makeHistoryResponse(["msg-ok", "msg-fail"])
    );
    (gmail.users.messages.get as jest.Mock)
      .mockResolvedValueOnce(makeMessage("msg-ok"))
      .mockRejectedValueOnce(new Error("API error"));

    await expect(
      processGmailNotification("test@example.com", "12345")
    ).resolves.toBeUndefined();

    // The successful message should still be stored
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it("does not throw when the Gmail history.list call fails", async () => {
    (db.query.users.findFirst as jest.Mock).mockResolvedValue(VALID_USER);
    (db.query.accounts.findFirst as jest.Mock).mockResolvedValue(VALID_ACCOUNT);

    const gmail = google.gmail({ version: "v1" });
    (gmail.users.history.list as jest.Mock).mockRejectedValue(
      new Error("Network error")
    );

    await expect(
      processGmailNotification("test@example.com", "12345")
    ).resolves.toBeUndefined();

    expect(db.insert).not.toHaveBeenCalled();
  });

  it("refreshes the token when it is expired and retries with the new token", async () => {
    const expiredAccount = {
      ...VALID_ACCOUNT,
      expires_at: Math.floor(Date.now() / 1000) - 60 // expired 1 minute ago
    };

    (db.query.users.findFirst as jest.Mock).mockResolvedValue(VALID_USER);
    (db.query.accounts.findFirst as jest.Mock).mockResolvedValue(expiredAccount);

    // getAccessToken is called on the OAuth2 instance used for refresh
    const newExpiry = Math.floor(Date.now() / 1000) + 3600;
    (google.auth.OAuth2 as unknown as jest.Mock).mockImplementation(() => ({
      setCredentials: jest.fn(),
      getAccessToken: jest.fn().mockResolvedValue({
        token: "new-token",
        res: { data: { expiry_date: newExpiry * 1000 } }
      })
    }));

    const gmail = google.gmail({ version: "v1" });
    (gmail.users.history.list as jest.Mock).mockResolvedValue(
      makeHistoryResponse(["msg-1"])
    );
    (gmail.users.messages.get as jest.Mock).mockResolvedValue(
      makeMessage("msg-1")
    );

    await processGmailNotification("test@example.com", "12345");

    // Token refresh: db.update should have been called to persist the new token
    expect(db.update).toHaveBeenCalled();
    // Email should still be stored
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
});
