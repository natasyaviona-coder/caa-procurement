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
  const [supplierId, setSupplierId] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const router = useRouter();

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Only .xlsx files are supported");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("File is larger than 50MB — that's not a price list");
      return;
    }
    if (!supplierId && !newSupplier.trim()) {
      toast.error("Pick a supplier (or type a new supplier name) first");
      return;
    }

    setUploading(true);
    try {
      // Browser uploads straight to Storage with the signed-in session, so
      // storage RLS (procurement/admin only) is what authorizes the write.
      const supabase = createClient();
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

      toast.success(`Uploaded ${file.name}`);
      setNewSupplier("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
      <div className="grid gap-1.5">
        <Label htmlFor="upload-supplier" className="text-xs">
          Supplier
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
          <option value="">— pick supplier —</option>
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
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <Button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Uploading…" : "Upload .xlsx"}
      </Button>
    </div>
  );
}
