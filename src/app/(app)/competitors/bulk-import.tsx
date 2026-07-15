"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { importCompetitorFileByName } from "./actions";

const MAX = 50 * 1024 * 1024;

type Result = {
  file: string;
  status: "pending" | "done" | "error";
  detail?: string;
};

// Uploads several competitor template files at once — each file becomes (or
// adds to) a competitor named after the file. Processes one at a time so a
// bad file doesn't sink the batch.
export function BulkImportCompetitors() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const router = useRouter();

  async function handleFiles(fileList: FileList) {
    const files = Array.from(fileList).filter((f) =>
      f.name.toLowerCase().endsWith(".xlsx")
    );
    if (files.length === 0) {
      toast.error("Pick one or more .xlsx files");
      return;
    }

    setBusy(true);
    setResults(files.map((f) => ({ file: f.name, status: "pending" })));
    const supabase = createClient();

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        if (f.size > MAX) throw new Error("larger than 50MB");
        const path = `competitor-import/${crypto.randomUUID()}/${f.name}`;
        const { error: upErr } = await supabase.storage
          .from("price-lists")
          .upload(path, f, {
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
        if (upErr) throw new Error(upErr.message);

        const res = await importCompetitorFileByName(path, f.name);
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: "done",
                  detail: `${res.competitorName}: ${res.inserted} products, ${res.photos} photos`,
                }
              : r
          )
        );
      } catch (err) {
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: "error",
                  detail: err instanceof Error ? err.message : "failed",
                }
              : r
          )
        );
      }
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    toast.success("Bulk import finished");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files);
        }}
      />
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Importing…" : "Bulk import .xlsx"}
      </Button>

      {results.length > 0 ? (
        <div className="rounded-md border p-3 text-sm">
          {results.map((r) => (
            <div key={r.file} className="flex items-start gap-2 py-0.5">
              <span className="w-4">
                {r.status === "done" ? "✓" : r.status === "error" ? "✗" : "…"}
              </span>
              <span className="font-medium">{r.file}</span>
              {r.detail ? (
                <span
                  className={
                    r.status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  — {r.detail}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
