"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateTripSheets, type SheetSelection } from "../actions";
import { cn } from "@/lib/utils";

export function SheetPicker({
  tripId,
  allSheets,
  initial,
}: {
  tripId: string;
  /** Every sheet in the workbook with its suggested classification. */
  allSheets: { index: number; name: string; suggestedKind: "supplier" | "other" }[];
  /** Currently saved selection (empty on first upload). */
  initial: SheetSelection[];
}) {
  const initialMap = new Map(initial.map((s) => [s.index, s]));
  const firstTime = initial.length === 0;

  const [state, setState] = useState(() =>
    allSheets.map((s) => ({
      ...s,
      included: firstTime ? true : initialMap.has(s.index),
      kind: initialMap.get(s.index)?.kind ?? s.suggestedKind,
    }))
  );
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    const chosen: SheetSelection[] = state
      .filter((s) => s.included)
      .map((s) => ({ index: s.index, name: s.name, kind: s.kind }));
    if (chosen.length === 0) {
      toast.error("Pick at least one sheet");
      return;
    }
    start(async () => {
      try {
        await updateTripSheets(tripId, chosen);
        toast.success("Sheets saved");
        router.push(`/trips/${tripId}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tick the sheets to include. Sheet names are treated as supplier names —
        switch a sheet to “Other” if it&apos;s a rekap/invoice sheet instead
        (I&apos;ve pre-guessed based on the name).
      </p>
      <div className="space-y-1 rounded-md border p-3">
        {state.map((s, i) => (
          <div
            key={s.index}
            className={cn(
              "flex items-center justify-between gap-3 rounded px-2 py-1.5",
              s.included ? "" : "opacity-50"
            )}
          >
            <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={s.included}
                onChange={(e) =>
                  setState((prev) =>
                    prev.map((p, pi) =>
                      pi === i ? { ...p, included: e.target.checked } : p
                    )
                  )
                }
              />
              <span className="font-medium">{s.name}</span>
            </label>
            <div className="flex gap-1 text-xs">
              {(["supplier", "other"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={!s.included}
                  onClick={() =>
                    setState((prev) =>
                      prev.map((p, pi) => (pi === i ? { ...p, kind: k } : p))
                    )
                  }
                  className={cn(
                    "rounded-md border px-2 py-1 capitalize",
                    s.kind === k
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {k === "supplier" ? "Supplier" : "Other (rekap/inv)"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Button onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save sheet selection"}
      </Button>
    </div>
  );
}
