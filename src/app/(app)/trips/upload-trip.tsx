"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { registerTrip, registerTripFromGoogleSheet } from "./actions";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function UploadTrip() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [linking, startLink] = useTransition();
  const router = useRouter();

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Only .xlsx files are supported");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("File is larger than 50MB");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const storagePath = `trips/${crypto.randomUUID()}/${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("price-lists")
        .upload(storagePath, file, {
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      if (upErr) throw new Error(upErr.message);

      const { id } = await registerTrip({
        fileName: file.name,
        storagePath,
        sizeBytes: file.size,
      });

      toast.success("Uploaded — now pick which sheets to include");
      router.push(`/trips/${id}?edit=1`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function importLink() {
    if (!sheetUrl.trim()) {
      toast.error("Paste a Google Sheet link first");
      return;
    }
    startLink(async () => {
      try {
        const { id } = await registerTripFromGoogleSheet(sheetUrl);
        toast.success("Imported — now pick which sheets to include");
        router.push(`/trips/${id}?edit=1`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
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
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Upload .xlsx"}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={sheetUrl}
          placeholder="…or paste Google Sheet link"
          className="w-64"
          onChange={(e) => setSheetUrl(e.target.value)}
        />
        <Button disabled={linking} onClick={importLink}>
          {linking ? "Importing…" : "Import"}
        </Button>
      </div>
    </div>
  );
}
