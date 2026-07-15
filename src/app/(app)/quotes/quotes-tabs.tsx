"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/quotes", label: "All Quotes" },
  { href: "/quotes/field", label: "Quotes Field" },
  { href: "/quotes/files", label: "Quotes File" },
] as const;

export function QuotesTabs() {
  const pathname = usePathname();
  // Longest matching prefix wins, so /quotes/field/new highlights Quotes Field
  // and /quotes/<id> highlights All Quotes.
  const active = TABS.reduce(
    (best, t) =>
      (pathname === t.href || pathname.startsWith(`${t.href}/`)) &&
      t.href.length > best.length
        ? t.href
        : best,
    "/quotes"
  );

  return (
    <div className="flex gap-1 border-b pb-2">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
            active === t.href && "bg-muted font-medium text-foreground"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
