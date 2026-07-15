"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Package,
  FileText,
  Plane,
  Target,
  Settings,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/login/actions";
import type { UserRole } from "@/lib/types/database";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/suppliers", label: "Suppliers", icon: Building2 },
  { href: "/products", label: "Products", icon: Package },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/trips", label: "Past Trips", icon: Plane },
  { href: "/competitors", label: "Competitors", icon: Target },
  { href: "/settings", label: "Settings", icon: Settings },
];

const roleLabel: Record<UserRole, string> = {
  admin: "Admin",
  procurement: "Procurement",
  viewer: "Viewer",
};

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
        CA
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-medium text-foreground">CAA</span>
        <span className="text-[11px] text-muted-foreground">Procurement</span>
      </div>
    </div>
  );
}

export function AppNav({ email, role }: { email: string; role: UserRole }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
      {LINKS.map((l) => {
        const active =
          l.href === "/"
            ? pathname === "/"
            : pathname === l.href || pathname.startsWith(`${l.href}/`);
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors md:py-1.5",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                active
                  ? "text-brand"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
              strokeWidth={2}
            />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );

  const userBlock = (
    <div className="border-t border-sidebar-border p-2">
      <div className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium uppercase text-muted-foreground">
          {email.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-xs font-medium text-foreground">{email}</div>
          <div className="text-[11px] text-muted-foreground">{roleLabel[role]}</div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            title="Sign out"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-14 items-center px-4">
          <Brand />
        </div>
        {nav}
        {userBlock}
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="size-5" />
        </button>
        <Brand />
      </header>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 flex h-svh w-64 flex-col border-r border-sidebar-border bg-sidebar shadow-xl">
            <div className="flex h-14 items-center justify-between px-4">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            {nav}
            {userBlock}
          </aside>
        </div>
      ) : null}
    </>
  );
}
