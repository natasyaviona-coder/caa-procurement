"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteFile, updateFileSupplier } from "../actions";

export function FileActions({
  fileId,
  fileName,
  currentSupplierId,
  suppliers,
  canDelete,
}: {
  fileId: string;
  fileName: string;
  currentSupplierId: string | null;
  suppliers: { id: string; name: string }[];
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [supplierId, setSupplierId] = useState(currentSupplierId ?? "");
  const [newSupplier, setNewSupplier] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function saveSupplier() {
    start(async () => {
      try {
        await updateFileSupplier(fileId, {
          supplierId: supplierId || null,
          newSupplierName: newSupplier.trim() || null,
        });
        toast.success("Supplier updated");
        setEditing(false);
        setNewSupplier("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  function removeFile() {
    if (
      !window.confirm(
        `Delete "${fileName}"?\n\nThis removes the uploaded file from the app. Products or quotes already imported from it are NOT affected.`
      )
    ) {
      return;
    }
    start(async () => {
      try {
        await deleteFile(fileId);
        toast.success("File deleted");
        router.push("/quotes/files");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {editing ? (
        <>
          <select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              if (e.target.value) setNewSupplier("");
            }}
            className="h-8 rounded-md border bg-transparent px-2 text-sm"
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
            placeholder="…or new name"
            className="h-8 w-36 text-sm"
            onChange={(e) => {
              setNewSupplier(e.target.value);
              if (e.target.value) setSupplierId("");
            }}
          />
          <Button size="sm" disabled={pending} onClick={saveSupplier}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit supplier
        </Button>
      )}
      {canDelete ? (
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={removeFile}
        >
          Delete file
        </Button>
      ) : null}
    </div>
  );
}
