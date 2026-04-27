"use client";

import { LogOut } from "lucide-react";

import { signOutAction } from "@/app/actions";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";

export interface UserMenuUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function UserMenu({ user }: { user: UserMenuUser }) {
  const initials = getInitials(user);
  const displayName = user.name || user.email || "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Open account menu"
        >
          <Avatar size="sm">
            {user.image ? (
              <AvatarImage src={user.image} alt={displayName} />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
          {user.name ? (
            <span className="text-sm font-medium leading-tight">
              {user.name}
            </span>
          ) : null}
          {user.email ? (
            <span className="text-xs text-muted-foreground leading-tight truncate">
              {user.email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer">
              <LogOut className="mr-2 size-4" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getInitials(user: UserMenuUser): string {
  const source = user.name || user.email || "";
  if (!source) return "?";
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
