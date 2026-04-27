import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/auth";
import { EmptyMessagePane } from "@/components/inbox/empty-message-pane";
import { MessageList } from "@/components/inbox/message-list";
import { MessagePane } from "@/components/inbox/message-pane";
import { MessagePaneLoading } from "@/components/inbox/message-pane-loading";
import { GoogleAccountNotConnectedError } from "@/lib/google-oauth-client";
import {
  getCachedList,
  getCachedMessage,
  type RecentMessageMetadata,
} from "@/lib/gmail";

type ListResult =
  | { ok: true; messages: RecentMessageMetadata[] }
  | { ok: false; reason: "not-connected" | "error" };

async function loadList(userId: string): Promise<ListResult> {
  try {
    const messages = await getCachedList(userId);
    return { ok: true, messages };
  } catch (err) {
    if (err instanceof GoogleAccountNotConnectedError) {
      return { ok: false, reason: "not-connected" };
    }
    console.error("Failed to load recent Gmail messages", err);
    return { ok: false, reason: "error" };
  }
}

export default async function AppHome({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const params = await searchParams;
  const selectedId = typeof params.msg === "string" ? params.msg : undefined;

  const listResult = await loadList(userId);

  if (listResult.ok) {
    await Promise.all(
      listResult.messages.map((m) =>
        getCachedMessage(userId, m.id).catch(() => null),
      ),
    );
  }

  if (!listResult.ok) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">
          {listResult.reason === "not-connected"
            ? "Couldn't reach Gmail — sign out and sign back in to reconnect."
            : "Couldn't load your inbox. Try again in a moment."}
        </p>
      </main>
    );
  }

  return (
    <main className="grid h-[calc(100vh-3.5rem)] grid-cols-1 md:grid-cols-2 md:divide-x md:divide-border">
      <MessageList messages={listResult.messages} selectedId={selectedId} />
      {selectedId ? (
        <Suspense key={selectedId} fallback={<MessagePaneLoading />}>
          <MessagePane userId={userId} id={selectedId} />
        </Suspense>
      ) : (
        <EmptyMessagePane />
      )}
    </main>
  );
}
