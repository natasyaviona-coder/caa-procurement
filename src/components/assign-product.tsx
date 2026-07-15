"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type ProductOption = { id: string; sku: string; name: string };

// Compact dropdown to tag a quote / competitor product to a shared product,
// so the same product can be compared across suppliers and against the market.
// `action` is a server action bound to the row id: (productId | null) => void.
export function AssignProduct({
  currentProductId,
  products,
  action,
}: {
  currentProductId: string | null;
  products: ProductOption[];
  action: (productId: string | null) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <select
      value={currentProductId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value || null;
        start(async () => {
          try {
            await action(v);
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save");
          }
        });
      }}
      className="h-8 max-w-40 rounded-md border bg-transparent px-2 text-xs disabled:opacity-50"
    >
      <option value="">— unmapped —</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.sku} · {p.name}
        </option>
      ))}
    </select>
  );
}
