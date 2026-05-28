"use client";

import { useActionState, useState } from "react";
import { FlaskConical } from "lucide-react";
import {
  runClassificationTest,
  type ClassifyTestState,
} from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Category = {
  id: string;
  name: string;
  description: string;
  color: string | null;
};

export function ClassifyTestDialog({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  // Bump on each open so <ClassifyForm> remounts — resets inputs + action state.
  const [runKey, setRunKey] = useState(0);
  const hasCategories = categories.length > 0;

  function onOpenChange(next: boolean) {
    if (next) setRunKey((k) => k + 1);
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasCategories}
        title={hasCategories ? undefined : "Create a category first"}
        onClick={() => onOpenChange(true)}
      >
        <FlaskConical />
        Test classification
      </Button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Test classification</DialogTitle>
          <DialogDescription>
            Paste an email and see which of your categories the model picks.
          </DialogDescription>
        </DialogHeader>
        <ClassifyForm key={runKey} categories={categories} />
      </DialogContent>
    </Dialog>
  );
}

function ClassifyForm({ categories }: { categories: Category[] }) {
  const [state, action, pending] = useActionState<ClassifyTestState, FormData>(
    runClassificationTest,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="test-subject">Subject</Label>
        <Input
          id="test-subject"
          name="subject"
          required
          placeholder="e.g. Your invoice from Acme"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="test-body">Body</Label>
        <Textarea
          id="test-body"
          name="body"
          required
          rows={6}
          placeholder="Paste the email body here…"
        />
      </div>

      <ResultPanel state={state} categories={categories} />

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">
          model: openai · max 3 labels
        </span>
        <Button type="submit" disabled={pending}>
          {pending ? "Running…" : "Run"}
        </Button>
      </div>
    </form>
  );
}

function ResultPanel({
  state,
  categories,
}: {
  state: ClassifyTestState;
  categories: Category[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
      <span className="font-mono text-[0.625rem] font-medium uppercase tracking-widest text-muted-foreground">
        Result
      </span>

      {state === null && (
        <p className="text-sm text-muted-foreground">
          Run a test to see matched categories.
        </p>
      )}

      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      {state?.ok && state.categoryIds.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No categories matched this email.
        </p>
      )}

      {state?.ok && state.categoryIds.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {state.categoryIds.map((id, i) => {
            const cat = categories.find((c) => c.id === id);
            const color = cat?.color ?? null;
            return (
              <li
                key={id}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm animate-in fade-in-0 slide-in-from-bottom-1"
                style={{
                  animationDelay: `${i * 60}ms`,
                  animationFillMode: "both",
                  borderColor: color ?? undefined,
                  backgroundColor: color ? `${color}1f` : undefined,
                  color: color ?? undefined,
                }}
              >
                <span className="font-medium">{cat?.name ?? id}</span>
                <span className="font-mono text-[0.625rem] opacity-70">
                  {id}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
