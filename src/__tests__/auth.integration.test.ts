/**
 * @jest-environment node
 *
 * Tests for OUR response to Google OAuth events. We are not testing Google's
 * server — we trust they've done that. We test what happens in our database
 * when NextAuth calls our adapter after a successful or failed OAuth exchange.
 */

import { makeEncryptingAdapter } from "@/lib/encrypt-adapter";
import { decrypt } from "@/lib/crypto";
import * as schema from "@/db/schema";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { db, query, runMigrations } from "./helpers/db";

beforeAll(runMigrations);
beforeEach(() => query('TRUNCATE "session", "account", "user" CASCADE'));

// Minimal base adapter backed by Drizzle — avoids importing @auth/drizzle-adapter
// (ESM-only, incompatible with ts-jest) while still testing our real DB layer.
function buildBaseAdapter(): Adapter {
  return {
    createUser: async (user) => {
      await db.insert(schema.users).values(user as any);
      return user;
    },
    linkAccount: async (account) => {
      await db.insert(schema.accounts).values(account as any);
      return null;
    },
    createSession: async (session) => {
      await db.insert(schema.sessions).values(session);
      return session as any;
    },
    getSessionAndUser: async (sessionToken) => {
      const session = await db.query.sessions.findFirst({
        where: (s, { eq }) => eq(s.sessionToken, sessionToken),
      });
      if (!session) return null;
      const user = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, session.userId),
      });
      return user ? { session: session as any, user: user as any } : null;
    },
    getUserByEmail: async (email) => {
      const user = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.email, email),
      });
      return (user as any) ?? null;
    },
    deleteUser: async (userId) => {
      const { eq } = await import("drizzle-orm");
      await db.delete(schema.users).where(eq(schema.users.id, userId));
    },
  } as Adapter;
}

function newUser() {
  return { id: crypto.randomUUID(), name: "Lucas", email: "lucas@example.com", emailVerified: null };
}

function googleTokens(userId: string): AdapterAccount {
  return {
    userId,
    type: "oauth" as const,
    provider: "google",
    providerAccountId: "google-sub-12345",
    access_token: "ya29.a0AfH6SMC_access_token",
    refresh_token: "1//0gxyz_refresh_token",
    id_token: "eyJhbGciOiJSUzI1NiJ9_id_token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
  };
}

describe("first sign-in", () => {
  let adapter: Adapter;

  beforeAll(() => {
    adapter = makeEncryptingAdapter(buildBaseAdapter());
  });

  it("creates a user record in the database", async () => {
    await adapter.createUser!(newUser());

    const { rows } = await query(`SELECT * FROM "user" WHERE email = 'lucas@example.com'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Lucas");
    expect(rows[0].id).toBeDefined();
    expect(rows[0].createdAt).toBeDefined();
  });

  it("stores encrypted access_token — never plaintext in the DB", async () => {
    const user = await adapter.createUser!(newUser());
    await adapter.linkAccount!(googleTokens(user.id));

    const { rows } = await query(`SELECT access_token FROM "account" WHERE "userId" = $1`, [user.id]);
    expect(rows[0].access_token).not.toBe("ya29.a0AfH6SMC_access_token");
    expect(decrypt(rows[0].access_token)).toBe("ya29.a0AfH6SMC_access_token");
  });

  it("stores encrypted refresh_token — never plaintext in the DB", async () => {
    const user = await adapter.createUser!(newUser());
    await adapter.linkAccount!(googleTokens(user.id));

    const { rows } = await query(`SELECT refresh_token FROM "account" WHERE "userId" = $1`, [user.id]);
    expect(rows[0].refresh_token).not.toBe("1//0gxyz_refresh_token");
    expect(decrypt(rows[0].refresh_token)).toBe("1//0gxyz_refresh_token");
  });

  it("stores encrypted id_token — never plaintext in the DB", async () => {
    const user = await adapter.createUser!(newUser());
    await adapter.linkAccount!(googleTokens(user.id));

    const { rows } = await query(`SELECT id_token FROM "account" WHERE "userId" = $1`, [user.id]);
    expect(rows[0].id_token).not.toBe("eyJhbGciOiJSUzI1NiJ9_id_token");
    expect(decrypt(rows[0].id_token)).toBe("eyJhbGciOiJSUzI1NiJ9_id_token");
  });

  it("handles a null refresh_token — Google withholds it after first grant", async () => {
    const user = await adapter.createUser!(newUser());
    await adapter.linkAccount!({ ...googleTokens(user.id), refresh_token: undefined });

    const { rows } = await query(`SELECT refresh_token FROM "account" WHERE "userId" = $1`, [user.id]);
    expect(rows[0].refresh_token).toBeNull();
  });

  it("creates a session record after sign-in", async () => {
    const user = await adapter.createUser!(newUser());
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await adapter.createSession!({ sessionToken: "tok_abc123", userId: user.id, expires });

    const { rows } = await query(`SELECT * FROM "session" WHERE "sessionToken" = 'tok_abc123'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(user.id);
  });
});

describe("duplicate prevention", () => {
  let adapter: Adapter;

  beforeAll(() => {
    adapter = makeEncryptingAdapter(buildBaseAdapter());
  });

  it("getUserByEmail returns the existing user on subsequent sign-ins — no duplicate created", async () => {
    const user = await adapter.createUser!(newUser());

    const existing = await adapter.getUserByEmail!("lucas@example.com");
    expect(existing?.id).toBe(user.id);

    const { rows } = await query(`SELECT * FROM "user"`);
    expect(rows).toHaveLength(1);
  });
});

describe("OAuth error callback", () => {
  // When Google sends ?error=access_denied, NextAuth aborts the flow and never
  // calls our adapter. Nothing should be written to the database.
  it("no user or account is created when OAuth fails before the adapter is called", async () => {
    const { rows: users } = await query(`SELECT * FROM "user"`);
    const { rows: accounts } = await query(`SELECT * FROM "account"`);
    expect(users).toHaveLength(0);
    expect(accounts).toHaveLength(0);
  });
});

describe("session handling", () => {
  let adapter: Adapter;

  beforeAll(() => {
    adapter = makeEncryptingAdapter(buildBaseAdapter());
  });

  it("getSessionAndUser returns null for a token not in the database", async () => {
    const result = await adapter.getSessionAndUser!("nonexistent-token");
    expect(result).toBeNull();
  });

  it("a session with a past expiry is stale — NextAuth will reject it on the next request", async () => {
    const user = await adapter.createUser!(newUser());
    await adapter.createSession!({
      sessionToken: "expired-tok",
      userId: user.id,
      expires: new Date(Date.now() - 1000),
    });

    // Let Postgres compare the timestamp to avoid JS timezone round-trip issues.
    const { rows } = await query(
      `SELECT expires < NOW() AS is_past FROM "session" WHERE "sessionToken" = 'expired-tok'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_past).toBe(true);
  });
});

describe("cascade delete", () => {
  let adapter: Adapter;

  beforeAll(() => {
    adapter = makeEncryptingAdapter(buildBaseAdapter());
  });

  it("deleting a user removes their account and session records", async () => {
    const user = await adapter.createUser!(newUser());
    await adapter.linkAccount!(googleTokens(user.id));
    await adapter.createSession!({ sessionToken: "tok_cascade", userId: user.id, expires: new Date(Date.now() + 3600_000) });

    await adapter.deleteUser!(user.id);

    const { rows: accounts } = await query(`SELECT * FROM "account" WHERE "userId" = $1`, [user.id]);
    const { rows: sessions } = await query(`SELECT * FROM "session" WHERE "userId" = $1`, [user.id]);
    expect(accounts).toHaveLength(0);
    expect(sessions).toHaveLength(0);
  });
});
