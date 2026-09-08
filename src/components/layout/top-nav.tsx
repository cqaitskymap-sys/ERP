"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Menu, Moon, Search, Sun, LogOut, UserRound, Shield } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { initials } from "@/lib/utils/format";
import { getRoleLabel } from "@/lib/permissions/catalog";
import { Can } from "@/components/auth/can";

interface TopNavProps {
  onOpenSidebar: () => void;
}

export function TopNav({ onOpenSidebar }: TopNavProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { user, profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <div className="lg:hidden">
        <BrandMark />
      </div>

      <div className="hidden min-w-0 lg:block">
        <Breadcrumbs />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden w-64 xl:block">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search workspace" className="pl-8" />
        </div>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="size-8">
                  <AvatarFallback>
                    {initials(profile?.name || user.displayName || user.email)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <p className="truncate font-medium">
                  {profile?.name || user.displayName || "Operator"}
                </p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </p>
                {profile ? (
                  <p className="mt-1 text-xs font-normal text-muted-foreground">
                    {getRoleLabel(profile.role)} · {profile.employeeId}
                  </p>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserRound />
                  Profile
                </Link>
              </DropdownMenuItem>
              <Can permission="users:read">
                <DropdownMenuItem asChild>
                  <Link href="/admin/users">
                    <Shield />
                    Users
                  </Link>
                </DropdownMenuItem>
              </Can>
              <Can permission="admin:read">
                <DropdownMenuItem asChild>
                  <Link href="/foundation">
                    <UserRound />
                    Foundation
                  </Link>
                </DropdownMenuItem>
              </Can>
              <DropdownMenuItem onClick={() => void signOut()}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
