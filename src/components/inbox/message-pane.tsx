import { getCachedMessage } from "@/lib/gmail";

export async function MessagePane({
  userId,
  id,
}: {
  userId: string;
  id: string;
}) {
  let msg;
  try {
    msg = await getCachedMessage(userId, id);
  } catch (err) {
    console.error("Failed to load message", id, err);
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load this email.
        </p>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-col overflow-y-auto">
      <div className="sticky top-0 z-[1] flex flex-col gap-1 border-b bg-background/80 px-6 py-3 backdrop-blur">
        <h1 className="font-heading text-base font-semibold leading-tight">
          {msg.subject || "(no subject)"}
        </h1>
        <p className="text-sm text-muted-foreground truncate">{msg.from}</p>
        {msg.date ? (
          <p className="text-xs text-muted-foreground">{msg.date}</p>
        ) : null}
      </div>
      <div className="px-6 py-4 text-sm leading-relaxed whitespace-pre-wrap break-words">
        {msg.body || (
          <span className="text-muted-foreground">(no preview available)</span>
        )}
      </div>
    </section>
  );
}
