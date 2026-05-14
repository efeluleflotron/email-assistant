import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { categories } from "@/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await db.query.categories.findMany({
    where: (c, { eq }) => eq(c.userId, userId),
    orderBy: (c, { asc }) => [asc(c.createdAt)],
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.name?.trim() || !body?.description?.trim()) {
    return NextResponse.json(
      { error: "name and description are required" },
      { status: 400 },
    );
  }

  try {
    const [created] = await db
      .insert(categories)
      .values({
        userId,
        name: String(body.name).trim(),
        description: String(body.description).trim(),
        color: body.color ? String(body.color) : null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    if ((err?.code ?? err?.cause?.code) === "23505") {
      return NextResponse.json(
        { error: "a category with that name already exists" },
        { status: 409 },
      );
    }
    throw err;
  }
}
