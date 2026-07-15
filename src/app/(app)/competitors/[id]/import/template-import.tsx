"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { COMPETITOR_FIELDS } from "@/lib/competitor-fields";
import { importCompetitorTemplate } from "../../actions";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const GRID = "[&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border";

type PreviewRow = { name: string; fields: Record<string, string> };

export function TemplateImport({
  competitorId,
  storagePath,
  fileName,
  sheetIndex,
  fxRate,
  totalRows,
  sample,
}: {
  competitorId: string;
  storagePath: string;
  fileName: string;
  sheetIndex: number;
  fxRate: number | null;
  totalRows: number;
  sample: PreviewRow[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function doImport() {
    start(async () => {
      try {
        const { inserted, photos } = await importCompetitorTemplate(
          competitorId,
          storagePath,
          fileName,
          sheetIndex
        );
        toast.success(`Imported ${inserted} products (${photos} photos)`);
        router.push(`/competitors/${competitorId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Recognized the competitor template — {totalRows} products found
        {fxRate ? `, sheet FX rate ¥1 = Rp${fxRate.toLocaleString("id-ID")}` : ""}.
        Photos will be embedded on import. Preview:
      </p>

      <div className="overflow-x-auto rounded-md border">
        <Table className={GRID}>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Produk</TableHead>
              {COMPETITOR_FIELDS.map((f) => (
                <TableHead
                  key={f.key}
                  className={cn(
                    "whitespace-nowrap",
                    "highlight" in f && f.highlight && "bg-yellow-200 text-yellow-950"
                  )}
                >
                  {f.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sample.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="max-w-52 text-xs">{r.name}</TableCell>
                {COMPETITOR_FIELDS.map((f) => (
                  <TableCell
                    key={f.key}
                    className={cn(
                      "max-w-48 whitespace-pre-line text-xs",
                      "highlight" in f && f.highlight && "bg-yellow-100 font-medium"
                    )}
                  >
                    {r.fields[f.key] || "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button onClick={doImport} disabled={pending} size="lg">
        {pending ? "Importing…" : `Import ${totalRows} products`}
      </Button>
    </div>
  );
}
