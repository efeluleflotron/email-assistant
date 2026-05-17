import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { db } from "@/db/client";
import { Button } from "@/components/ui/button";
import { CategoriesSection } from "@/components/categories-section";

export default async function AppHome() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const userCategories = userId
    ? await db.query.categories.findMany({
      where: (c, { eq }) => eq(c.userId, userId),
      orderBy: (c, { asc }) => [asc(c.createdAt)]
    })
    : [];

  return (
    <main className="flex min-h-screen flex-col gap-8 p-8">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{session.user.email}</h1>
          <p className="text-muted-foreground">Gmail connected ✓</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>

      <CategoriesSection categories={userCategories} />
    </main>
  );
}
