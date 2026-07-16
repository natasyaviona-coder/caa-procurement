"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/competitors", label: "Competitors" },
  { href: "/competitors/all", label: "All Products" },
];

export function CompetitorsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b">
      {TABS.map((t) => {
        const active =
          t.href === "/competitors/all"
            ? pathname.startsWith("/competitors/all")
            : pathname === "/competitors" ||
              (pathname.startsWith("/competitors/") &&
                !pathname.startsWith("/competitors/all"));
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
