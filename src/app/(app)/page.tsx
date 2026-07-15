import Link from "next/link";
import { ArrowUpRight, Building2, Package, FileText, Plane, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

async function getCounts() {
  const supabase = await createClient();
  const [suppliers, products, quotes, competitors, trips] = await Promise.all([
    supabase.from("suppliers").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("supplier_quotes").select("*", { count: "exact", head: true }),
    supabase.from("competitors").select("*", { count: "exact", head: true }),
    supabase.from("trips").select("*", { count: "exact", head: true }),
  ]);
  return {
    suppliers: suppliers.count ?? 0,
    products: products.count ?? 0,
    quotes: quotes.count ?? 0,
    competitors: competitors.count ?? 0,
    trips: trips.count ?? 0,
  };
}

export default async function DashboardPage() {
  const counts = await getCounts();

  const cards = [
    {
      href: "/suppliers",
      title: "Suppliers",
      count: counts.suppliers,
      description: "Factories, 1688 sellers, direct contacts",
      icon: Building2,
    },
    {
      href: "/products",
      title: "Products",
      count: counts.products,
      description: "SKUs with stock + spec",
      icon: Package,
    },
    {
      href: "/quotes",
      title: "Supplier Quotes",
      count: counts.quotes,
      description: "RMB prices, MOQs, dates",
      icon: FileText,
    },
    {
      href: "/trips",
      title: "Past Trips",
      count: counts.trips,
      description: "Trip workbooks + supplier orders",
      icon: Plane,
    },
    {
      href: "/competitors",
      title: "Competitors",
      count: counts.competitors,
      description: "Market pricing + target RMB",
      icon: Target,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A snapshot of your sourcing operation across suppliers, products,
          quotes, trips, and competitors.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.href} href={c.href} className="group">
              <Card className="gap-0 transition-colors hover:border-brand/40">
                <div className="flex items-start justify-between px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-brand/10 group-hover:text-brand">
                      <Icon className="size-4" strokeWidth={2} />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {c.title}
                    </span>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground/50 transition-colors group-hover:text-brand" />
                </div>
                <div className="mt-4 px-4">
                  <div className="text-3xl font-semibold tabular-nums tracking-tight">
                    {c.count}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.description}
                  </p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
