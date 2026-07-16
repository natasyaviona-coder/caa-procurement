"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startFieldSession } from "./actions";

export function StartFoto({
  suppliers,
}: {
  suppliers: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function go() {
    if (!supplierId && !newSupplier.trim()) {
      toast.error("Pick a supplier or type a new supplier name first");
      return;
    }
    start(async () => {
      try {
        const { supplierId: id } = await startFieldSession({
          supplierId: supplierId || null,
          newSupplierName: newSupplier.trim() || null,
        });
        router.push(`/quotes/field/new?supplier=${id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not start");
      }
    });
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Start foto</Button>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
      <select
        value={supplierId}
        onChange={(e) => {
          setSupplierId(e.target.value);
          if (e.target.value) setNewSupplier("");
        }}
        className="h-9 min-w-44 rounded-md border bg-transparent px-3 text-sm"
      >
        <option value="">— pick supplier —</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Input
        value={newSupplier}
        placeholder="…or new supplier name"
        className="h-9 w-44"
        onChange={(e) => {
          setNewSupplier(e.target.value);
          if (e.target.value) setSupplierId("");
        }}
      />
      <Button disabled={pending} onClick={go}>
        {pending ? "Starting…" : "Continue"}
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => router.push("/quotes/field/new")}
        title="Capture now and pick the supplier later from the list"
      >
        Skip — add supplier later
      </Button>
      <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
