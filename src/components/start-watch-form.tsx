"use client";

import { useActionState } from "react";

import {
  startGmailWatchAction,
  type StartWatchState,
} from "@/app/actions";
import { Button } from "@/components/shadcn/button";

const INITIAL: StartWatchState = { status: "idle" };

export function StartWatchForm() {
  const [state, formAction, pending] = useActionState(
    startGmailWatchAction,
    INITIAL,
  );

  return (
    <form
      action={formAction}
      className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 text-sm"
    >
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Starting…" : "Start Gmail watch"}
      </Button>
      {state.status === "ok" && (
        <span className="text-muted-foreground">
          Watch active — historyId{" "}
          <code className="font-mono">{state.historyId}</code>, expires{" "}
          {new Date(state.expiration).toLocaleString()}
        </span>
      )}
      {state.status === "error" && (
        <span className="text-destructive">{state.message}</span>
      )}
    </form>
  );
}
