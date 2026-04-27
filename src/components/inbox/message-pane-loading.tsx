import { Loader2 } from "lucide-react";

export function MessagePaneLoading() {
  return (
    <section className="flex min-h-0 flex-1 items-center justify-center p-8">
      <Loader2
        className="size-6 animate-spin text-muted-foreground"
        aria-label="Loading email"
      />
    </section>
  );
}
