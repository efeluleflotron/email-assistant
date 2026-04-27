import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { encrypt } from "@/lib/crypto";

export function makeEncryptingAdapter(base: Adapter): Adapter {
  return {
    ...base,
    linkAccount: (account: AdapterAccount) => {
      return base.linkAccount!({
        ...account,
        access_token: account.access_token
          ? encrypt(account.access_token)
          : account.access_token,
        refresh_token: account.refresh_token
          ? encrypt(account.refresh_token)
          : account.refresh_token,
        id_token: account.id_token
          ? encrypt(account.id_token)
          : account.id_token,
      });
    },
  };
}
