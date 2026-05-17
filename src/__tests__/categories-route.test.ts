/**
 * @jest-environment node
 *
 * Integration tests for the categories API routes. Uses a real PostgreSQL
 * database (same as the test DATABASE_URL) and mocks auth() to simulate
 * authenticated sessions. Follows the runMigrations + TRUNCATE pattern used
 * throughout this project.
 */

jest.mock("@/auth", () => ({
  auth: jest.fn()
}));

import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/categories/route";
import { PATCH, DELETE } from "@/app/api/categories/[id]/route";
import { db, query, runMigrations } from "./helpers/db";
import * as schema from "@/db/schema";

const USER_1 = { id: "cat-test-user-1", email: "cat1@test.com" } as const;
const USER_2 = { id: "cat-test-user-2", email: "cat2@test.com" } as const;

// ── helpers ──────────────────────────────────────────────────────────────────
function session(user: { id: string; email: string }) {
  return { user };
}

function makeRequest(
  url: string,
  method: string,
  body?: unknown
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

// ── lifecycle ─────────────────────────────────────────────────────────────────
beforeAll(runMigrations);

beforeEach(async () => {
  await query(
    "TRUNCATE \"email_category\", \"email\", \"category\", \"session\", \"account\", \"user\" CASCADE"
  );
  // Seed two test users so FK constraints on categories are satisfied
  await db
    .insert(schema.users)
    .values([
      { id: USER_1.id, email: USER_1.email },
      { id: USER_2.id, email: USER_2.email }
    ]);
});

// ── GET /api/categories ───────────────────────────────────────────────────────
describe("GET /api/categories", () => {
  it("returns 401 when not authenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns an empty array when the user has no categories", async () => {
    (auth as jest.Mock).mockResolvedValue(session(USER_1));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns only the authenticated user's categories", async () => {
    // Insert one category per user
    await db.insert(schema.categories).values([
      { userId: USER_1.id, name: "Work", description: "Work emails" },
      { userId: USER_2.id, name: "Personal", description: "Personal emails" }
    ]);

    (auth as jest.Mock).mockResolvedValue(session(USER_1));
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Work");
  });
});

// ── POST /api/categories ─────────────────────────────────────────────────────
describe("POST /api/categories", () => {
  it("returns 401 when not authenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await POST(
      makeRequest(
        "http://localhost/api/categories",
        "POST",
        { name: "Finance", description: "Bank emails" }
      )
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when name or description is missing", async () => {
    (auth as jest.Mock).mockResolvedValue(session(USER_1));

    const noName = await POST(
      makeRequest("http://localhost/api/categories", "POST", {
        description: "desc"
      })
    );
    expect(noName.status).toBe(400);

    const noDesc = await POST(
      makeRequest("http://localhost/api/categories", "POST", { name: "X" })
    );
    expect(noDesc.status).toBe(400);
  });

  it("creates a category and returns 201 with the new row", async () => {
    (auth as jest.Mock).mockResolvedValue(session(USER_1));
    const res = await POST(
      makeRequest("http://localhost/api/categories", "POST", {
        name: "Finance",
        description: "Bank emails",
        color: "#ff0000"
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Finance");
    expect(body.description).toBe("Bank emails");
    expect(body.color).toBe("#ff0000");
    expect(body.userId).toBe(USER_1.id);
    expect(body.id).toBeTruthy();
  });

  it("returns 409 when a category with the same name already exists for the user", async () => {
    (auth as jest.Mock).mockResolvedValue(session(USER_1));
    await POST(
      makeRequest("http://localhost/api/categories", "POST", {
        name: "Finance",
        description: "Bank emails"
      })
    );
    const dup = await POST(
      makeRequest("http://localhost/api/categories", "POST", {
        name: "Finance",
        description: "Another bank"
      })
    );
    expect(dup.status).toBe(409);
  });

  it("allows two users to have categories with the same name", async () => {
    (auth as jest.Mock).mockResolvedValue(session(USER_1));
    const r1 = await POST(
      makeRequest("http://localhost/api/categories", "POST", {
        name: "Finance",
        description: "desc"
      })
    );

    (auth as jest.Mock).mockResolvedValue(session(USER_2));
    const r2 = await POST(
      makeRequest("http://localhost/api/categories", "POST", {
        name: "Finance",
        description: "desc"
      })
    );

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });
});

// ── PATCH /api/categories/[id] ───────────────────────────────────────────────
describe("PATCH /api/categories/[id]", () => {
  async function seedCategory(userId: string, name = "Work") {
    const [cat] = await db
      .insert(schema.categories)
      .values({ userId, name, description: "Original desc" })
      .returning();
    return cat;
  }

  it("returns 401 when not authenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(
      makeRequest("http://localhost/api/categories/x", "PATCH", { name: "X" }),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown category id", async () => {
    (auth as jest.Mock).mockResolvedValue(session(USER_1));
    const res = await PATCH(
      makeRequest("http://localhost/api/categories/nonexistent", "PATCH", {
        name: "X"
      }),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when the category belongs to another user", async () => {
    const cat = await seedCategory(USER_2.id);
    (auth as jest.Mock).mockResolvedValue(session(USER_1));
    const res = await PATCH(
      makeRequest(`http://localhost/api/categories/${cat.id}`, "PATCH", {
        name: "X"
      }),
      { params: Promise.resolve({ id: cat.id }) }
    );
    expect(res.status).toBe(403);
  });

  it("updates and returns the category", async () => {
    const cat = await seedCategory(USER_1.id);
    (auth as jest.Mock).mockResolvedValue(session(USER_1));
    const res = await PATCH(
      makeRequest(`http://localhost/api/categories/${cat.id}`, "PATCH", {
        name: "Updated",
        description: "New desc",
        color: "#0000ff"
      }),
      { params: Promise.resolve({ id: cat.id }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Updated");
    expect(body.description).toBe("New desc");
    expect(body.color).toBe("#0000ff");
  });

  it("returns 409 when the new name conflicts with an existing category", async () => {
    await seedCategory(USER_1.id, "Work");
    const cat2 = await seedCategory(USER_1.id, "Personal");

    (auth as jest.Mock).mockResolvedValue(session(USER_1));
    const res = await PATCH(
      makeRequest(`http://localhost/api/categories/${cat2.id}`, "PATCH", {
        name: "Work"
      }),
      { params: Promise.resolve({ id: cat2.id }) }
    );
    expect(res.status).toBe(409);
  });
});

// ── DELETE /api/categories/[id] ──────────────────────────────────────────────
describe("DELETE /api/categories/[id]", () => {
  async function seedCategory(userId: string) {
    const [cat] = await db
      .insert(schema.categories)
      .values({ userId, name: "To Delete", description: "desc" })
      .returning();
    return cat;
  }

  it("returns 401 when not authenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await DELETE(
      makeRequest("http://localhost/api/categories/x", "DELETE"),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown category id", async () => {
    (auth as jest.Mock).mockResolvedValue(session(USER_1));
    const res = await DELETE(
      makeRequest("http://localhost/api/categories/nonexistent", "DELETE"),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when the category belongs to another user", async () => {
    const cat = await seedCategory(USER_2.id);
    (auth as jest.Mock).mockResolvedValue(session(USER_1));
    const res = await DELETE(
      makeRequest(`http://localhost/api/categories/${cat.id}`, "DELETE"),
      { params: Promise.resolve({ id: cat.id }) }
    );
    expect(res.status).toBe(403);
  });

  it("deletes the category and returns 204", async () => {
    const cat = await seedCategory(USER_1.id);
    (auth as jest.Mock).mockResolvedValue(session(USER_1));

    const res = await DELETE(
      makeRequest(`http://localhost/api/categories/${cat.id}`, "DELETE"),
      { params: Promise.resolve({ id: cat.id }) }
    );
    expect(res.status).toBe(204);

    // Confirm it's gone
    const res2 = await DELETE(
      makeRequest(`http://localhost/api/categories/${cat.id}`, "DELETE"),
      { params: Promise.resolve({ id: cat.id }) }
    );
    expect(res2.status).toBe(404);
  });
});
