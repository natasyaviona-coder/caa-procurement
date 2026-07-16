"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setCompetitorProductCompetitor } from "@/app/(app)/competitors/actions";

export type CompetitorOption = { id: string; name: string };

// Dropdown to file an unassigned competitor product (e.g. a bulk-uploaded
// market picture) under a competitor.
export function AssignCompetitor({
  productId,
  competitors,
}: {
  productId: string;
  competitors: CompetitorOption[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <select
      defaultValue=""
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value || null;
        if (!v) return;
        start(async () => {
          try {
            await setCompetitorProductCompetitor(productId, v);
            toast.success("Filed under competitor");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save");
          }
        });
      }}
      className="h-8 max-w-48 rounded-md border border-input bg-transparent px-2 text-xs disabled:opacity-50"
    >
      <option value="">— file under… —</option>
      {competitors.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
