import Link from "next/link";

import type { RecentMessageMetadata } from "@/lib/gmail";

export function MessageList({
  messages,
  selectedId,
}: {
  messages: RecentMessageMetadata[];
  selectedId: string | undefined;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-y-auto">
      <div className="sticky top-0 z-[1] flex h-12 items-center border-b bg-background/80 px-6 backdrop-blur">
        <h2 className="font-heading text-sm font-medium">Recent emails</h2>
      </div>
      {messages.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          No recent messages.
        </p>
      ) : (
        <ul>
          {messages.map((msg) => {
            const isActive = msg.id === selectedId;
            return (
              <li key={msg.id}>
                <Link
                  href={{ query: { msg: msg.id } }}
                  scroll={false}
                  data-active={isActive ? true : undefined}
                  className="flex flex-col gap-0.5 border-b px-6 py-3 transition-colors hover:bg-muted/60 data-[active]:bg-muted"
                  aria-current={isActive ? "true" : undefined}
                >
                  <span className="truncate font-medium">
                    {msg.subject || "(no subject)"}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {msg.from}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
