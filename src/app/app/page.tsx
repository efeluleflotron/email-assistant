import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function AppHome() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">
        Hi, {session.user.email}
      </h1>
      <p className="text-muted-foreground">Gmail connected ✓</p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button type="submit" variant="outline" size="sm" className="w-fit">
          Sign out
        </Button>
      </form>
    </main>
  );
}
