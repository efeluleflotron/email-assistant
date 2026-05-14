"use client";

import { useEffect, useState, useActionState } from "react";
import { upsertCategory, deleteCategory, type ActionState } from "@/app/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Category = {
  id: string;
  name: string;
  description: string;
  color: string | null;
};

export function CategoriesSection({
  categories,
}: {
  categories: Category[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [upsertState, upsertAction, upsertPending] = useActionState(
    upsertCategory,
    null,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteCategory,
    null,
  );

  useEffect(() => {
    if (upsertState?.ok) {
      setDialogOpen(false);
      setEditing(null);
    }
  }, [upsertState]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setDialogOpen(true);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Button size="sm" onClick={openCreate}>
          New category
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No categories yet. Create one to start organising your inbox.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Card key={cat.id} size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {cat.color && (
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full border"
                      style={{ backgroundColor: cat.color }}
                    />
                  )}
                  {cat.name}
                </CardTitle>
                <CardDescription>{cat.description}</CardDescription>
              </CardHeader>
              <CardFooter className="gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEdit(cat)}
                >
                  Edit
                </Button>
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={cat.id} />
                  <Button
                    type="submit"
                    size="sm"
                    variant="destructive"
                    disabled={deletePending}
                  >
                    Delete
                  </Button>
                </form>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit category" : "New category"}
            </DialogTitle>
          </DialogHeader>
          <form action={upsertAction} className="flex flex-col gap-4">
            {editing && (
              <input type="hidden" name="id" value={editing.id} />
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                name="name"
                required
                defaultValue={editing?.name ?? ""}
                placeholder="e.g. Finance"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-desc">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (used by AI to classify emails)
                </span>
              </Label>
              <Input
                id="cat-desc"
                name="description"
                required
                defaultValue={editing?.description ?? ""}
                placeholder="e.g. Emails from banks or about financial transactions."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-color">Color</Label>
              <Input
                id="cat-color"
                name="color"
                type="color"
                defaultValue={editing?.color ?? "#6366f1"}
                className="h-9 w-16 cursor-pointer p-1"
              />
            </div>
            {upsertState && !upsertState.ok && (
              <p className="text-sm text-destructive">{upsertState.error}</p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={upsertPending}>
                {upsertPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
