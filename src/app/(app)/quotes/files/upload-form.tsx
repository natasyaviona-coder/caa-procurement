"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { recordUploadedFile } from "./actions";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB — largest real price list seen is ~16MB

export function UploadForm({
  suppliers,
}: {
  suppliers: { id: string; name: string }[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const router = useRouter();

  async function handleFiles(files: File[]) {
    const valid = files.filter(
      (f) => f.name.toLowerCase().endsWith(".xlsx") && f.size <= MAX_UPLOAD_BYTES
    );
    const skipped = files.length - valid.length;
    if (valid.length === 0) {
      toast.error("No valid .xlsx files (each must be .xlsx and under 50MB)");
      return;
    }

    setUploading(true);
    let ok = 0;
    try {
      // Browser uploads straight to Storage with the signed-in session, so
      // storage RLS (procurement/admin only) is what authorizes the write.
      const supabase = createClient();
      for (let i = 0; i < valid.length; i++) {
        const file = valid[i];
        if (valid.length > 1) setProgress(`Uploading ${i + 1} of ${valid.length}…`);
        try {
          const storagePath = `${crypto.randomUUID()}/${file.name}`;
          const { error: upErr } = await supabase.storage
            .from("price-lists")
            .upload(storagePath, file, {
              contentType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
          if (upErr) throw new Error(upErr.message);

          await recordUploadedFile({
            fileName: file.name,
            storagePath,
            sizeBytes: file.size,
            supplierId: supplierId || null,
            newSupplierName: newSupplier.trim() || null,
          });
          ok++;
        } catch (err) {
          toast.error(
            `${file.name}: ${err instanceof Error ? err.message : "upload failed"}`
          );
        }
      }

      if (ok > 0) {
        toast.success(
          `Uploaded ${ok} file${ok === 1 ? "" : "s"}` +
            (skipped ? ` · skipped ${skipped} unsupported` : "")
        );
        setNewSupplier("");
        router.refresh();
      }
    } finally {
      setUploading(false);
      setProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
      <div className="grid gap-1.5">
        <Label htmlFor="upload-supplier" className="text-xs">
          Supplier (optional — applies to all)
        </Label>
        <select
          id="upload-supplier"
          value={supplierId}
          onChange={(e) => {
            setSupplierId(e.target.value);
            if (e.target.value) setNewSupplier("");
          }}
          className="h-9 min-w-44 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">— assign later —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="upload-new-supplier" className="text-xs">
          …or new supplier name
        </Label>
        <Input
          id="upload-new-supplier"
          value={newSupplier}
          placeholder="e.g. FEI"
          className="h-9 w-44"
          onChange={(e) => {
            setNewSupplier(e.target.value);
            if (e.target.value) setSupplierId("");
          }}
        />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void handleFiles(files);
        }}
      />
      <Button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? progress || "Uploading…" : "Upload .xlsx"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        Tip: select multiple .xlsx files to upload them all at once.
      </p>
    </div>
  );
}
