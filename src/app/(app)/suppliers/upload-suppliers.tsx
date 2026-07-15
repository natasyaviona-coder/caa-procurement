"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const MAX = 50 * 1024 * 1024;

// Uploads a suppliers workbook to a temp path, then opens the column-mapping page.
export function UploadSuppliers() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handle(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Only .xlsx files are supported");
      return;
    }
    if (file.size > MAX) {
      toast.error("File is larger than 50MB");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const path = `supplier-import/${crypto.randomUUID()}/${file.name}`;
      const { error } = await supabase.storage
        .from("price-lists")
        .upload(path, file, {
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      if (error) throw new Error(error.message);
      router.push(
        `/suppliers/import?path=${encodeURIComponent(path)}&file=${encodeURIComponent(
          file.name
        )}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handle(f);
        }}
      />
      <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Uploading…" : "Import .xlsx"}
      </Button>
    </>
  );
}
