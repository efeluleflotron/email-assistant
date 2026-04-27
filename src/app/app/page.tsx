import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function AppHome() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">
        Hi, {session.user.email}
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">Gmail connected ✓</p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="w-fit rounded-full border border-black/10 px-5 py-2 text-sm transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
