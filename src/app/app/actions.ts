"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { classifyEmail } from "@/lib/ai/classifier";
import { AIClientError } from "@/lib/ai/errors";

export type ActionState = { ok: true } | { ok: false; error: string } | null;

export async function upsertCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Unauthorized" };

  const id = (formData.get("id") as string)?.trim() || null;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const color = (formData.get("color") as string) || null;

  if (!name || !description) {
    return { ok: false, error: "Name and description are required" };
  }

  try {
    if (id) {
      const existing = await db.query.categories.findFirst({
        where: (c, { eq }) => eq(c.id, id),
      });
      if (!existing) return { ok: false, error: "Not found" };
      if (existing.userId !== userId) return { ok: false, error: "Forbidden" };

      await db
        .update(categories)
        .set({ name, description, color, updatedAt: new Date() })
        .where(eq(categories.id, id));
    } else {
      await db.insert(categories).values({ userId, name, description, color });
    }
    revalidatePath("/app");
    return { ok: true };
  } catch (err: any) {
    if ((err?.code ?? err?.cause?.code) === "23505") {
      return { ok: false, error: "A category with that name already exists" };
    }
    throw err;
  }
}

export async function deleteCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Unauthorized" };

  const id = (formData.get("id") as string)?.trim();
  if (!id) return { ok: false, error: "Missing id" };

  const existing = await db.query.categories.findFirst({
    where: (c, { eq }) => eq(c.id, id),
  });
  if (!existing) return { ok: false, error: "Not found" };
  if (existing.userId !== userId) return { ok: false, error: "Forbidden" };

  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/app");
  return { ok: true };
}

export type ClassifyTestState =
  | { ok: true; categoryIds: string[] }
  | { ok: false; error: string }
  | null;

export async function runClassificationTest(
  _prev: ClassifyTestState,
  formData: FormData,
): Promise<ClassifyTestState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Unauthorized" };

  const subject = (formData.get("subject") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  if (!subject || !body) {
    return { ok: false, error: "Subject and body are required" };
  }

  const userCategories = await db.query.categories.findMany({
    where: (c, { eq }) => eq(c.userId, userId),
  });
  if (userCategories.length === 0) {
    return { ok: false, error: "Create a category first" };
  }

  try {
    const { categoryIds } = await classifyEmail({
      subject,
      body,
      categories: userCategories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
    });
    return { ok: true, categoryIds };
  } catch (err) {
    if (err instanceof AIClientError) {
      const msg =
        err.kind === "config"
          ? "OpenAI key not configured. Add OPENAI_API_KEY to .env.local."
          : err.kind === "timeout"
            ? "The model took too long. Try again."
            : "Classification failed. Try again.";
      return { ok: false, error: msg };
    }
    throw err;
  }
}
