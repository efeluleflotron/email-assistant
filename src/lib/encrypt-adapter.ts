import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { encrypt } from "@/lib/crypto";
import { dispatchGmailWatch } from "@/lib/gmail-watch";

function maybeEncrypt(value: string | undefined): string | undefined {
  return value ? encrypt(value) : value;
}

function encryptAccountTokens(account: AdapterAccount): AdapterAccount {
  return {
    ...account,
    access_token: maybeEncrypt(account.access_token),
    refresh_token: maybeEncrypt(account.refresh_token),
    id_token: maybeEncrypt(account.id_token),
  };
}

export function makeEncryptingAdapter(base: Adapter): Adapter {
  return {
    ...base,
    linkAccount: (account: AdapterAccount) => {
      if (account.provider === "google" && account.access_token) {
        dispatchGmailWatch(account.access_token, {
          userId: account.userId,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        });
      }
      return base.linkAccount!(encryptAccountTokens(account));
    },
  };
}
