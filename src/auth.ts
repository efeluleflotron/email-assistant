import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { db } from "@/db/client";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { encrypt } from "@/lib/crypto";

const baseAdapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

// Wrap linkAccount so OAuth tokens never land in Postgres as plaintext.
const encryptingAdapter: Adapter = {
  ...baseAdapter,
  linkAccount: async (account: AdapterAccount) => {
    const encrypted: AdapterAccount = {
      ...account,
      refresh_token: account.refresh_token
        ? encrypt(account.refresh_token)
        : account.refresh_token,
      access_token: account.access_token
        ? encrypt(account.access_token)
        : account.access_token,
      id_token: account.id_token ? encrypt(account.id_token) : account.id_token,
    };
    return baseAdapter.linkAccount!(encrypted);
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: encryptingAdapter,
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
});
