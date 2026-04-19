import * as React from "react";
import { Link, useLocation } from "wouter";
import { FlaskConical, LayoutGrid, BookOpen, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; match: (p: string) => boolean };

const NAV: NavItem[] = [
  { href: "/",     label: "Matters", icon: LayoutGrid, match: (p) => p === "/" || p.startsWith("/matters") },
  { href: "/docs", label: "Docs",    icon: BookOpen,   match: (p) => p.startsWith("/docs") },
];

export function Sidebar() {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const initials = (user?.fullName ?? "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="hidden lg:flex lg:w-[60px] shrink-0 flex-col items-center border-r border-border bg-card/40 py-4">
      <Link href="/" className="mb-6 flex h-10 w-10 items-center justify-center rounded-md bg-gold/10 text-gold transition-colors hover:bg-gold/20">
        <FlaskConical className="h-5 w-5" />
        <span className="sr-only">InventorLab</span>
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.match(location);
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    active && "bg-accent text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger className="mt-auto flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-[0.6875rem] font-semibold text-gold transition-all hover:bg-gold/25 focus:outline-none focus:ring-2 focus:ring-ring">
          {initials || "?"}
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{user?.fullName ?? "Signed in"}</span>
            <span className="text-[0.6875rem] text-muted-foreground">{user?.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <Settings className="h-4 w-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={async () => { await logout(); navigate("/auth"); }} className="text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}
