import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu, type UserMenuUser } from "@/components/user-menu";

export function AppHeader({ user }: { user: UserMenuUser }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 w-full items-center justify-between border-b bg-background/80 px-4 backdrop-blur sm:px-6">
      <span className="font-heading text-sm font-medium tracking-tight">
        Email Assistant
      </span>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
