import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/app");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Email Assistant</h1>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/app" });
        }}
      >
        <button
          type="submit"
          className="rounded-full border border-black/10 bg-black px-6 py-3 text-white transition-colors hover:bg-zinc-800 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
