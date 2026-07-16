"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type SupplierOption = { id: string; name: string };

// Compact dropdown to set (or change) the supplier on a field quote captured
// before the supplier was known. `action` is bound to the row id.
export function AssignSupplier({
  currentSupplierId,
  suppliers,
  action,
}: {
  currentSupplierId: string | null;
  suppliers: SupplierOption[];
  action: (supplierId: string | null) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <select
      value={currentSupplierId ?? ""}
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
      className="h-8 max-w-44 rounded-md border border-input bg-transparent px-2 text-xs disabled:opacity-50"
    >
      <option value="">— set supplier —</option>
      {suppliers.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
