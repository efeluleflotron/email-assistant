"use server";

import { auth, signOut } from "@/auth";
import { startGmailWatch } from "@/lib/gmail";
import { GoogleAccountNotConnectedError } from "@/lib/google-oauth-client";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export type StartWatchState =
  | { status: "idle" }
  | { status: "ok"; historyId: string; expiration: number }
  | { status: "error"; message: string };

export async function startGmailWatchAction(
  _prev: StartWatchState,
): Promise<StartWatchState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", message: "Not signed in" };
  }

  const topic = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topic) {
    return {
      status: "error",
      message: "GMAIL_PUBSUB_TOPIC is not configured",
    };
  }

  try {
    const result = await startGmailWatch(session.user.id, topic);
    return { status: "ok", ...result };
  } catch (err) {
    if (err instanceof GoogleAccountNotConnectedError) {
      return {
        status: "error",
        message: "Google account not connected — sign in again",
      };
    }
    console.error("startGmailWatchAction failed", err);
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
