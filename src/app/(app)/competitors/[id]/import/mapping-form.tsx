"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { reversibleRmb, parseIdr } from "@/lib/reverse-rmb";
import { importCompetitorProducts, type ImportMapping } from "../../actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Column = { index: number; label: string };
type SheetOption = { index: number; name: string };

export function MappingForm({
  competitorId,
  storagePath,
  fileName,
  sheets,
  activeSheet,
  columns,
  headerRowIdx,
  sampleRows,
  guess,
  assumptions,
}: {
  competitorId: string;
  storagePath: string;
  fileName: string;
  sheets: SheetOption[];
  activeSheet: number;
  columns: Column[];
  headerRowIdx: number;
  /** First few data rows (cells as strings) for preview. */
  sampleRows: string[][];
  guess: { nameCol: number; priceCol: number | null };
  assumptions: { fxRate: number; adminPct: number; targetMarginPct: number };
}) {
  const [nameCol, setNameCol] = useState(guess.nameCol);
  const [priceCol, setPriceCol] = useState<number | null>(guess.priceCol);
  const [photoCol, setPhotoCol] = useState<number | null>(null);
  const [specCol, setSpecCol] = useState<number | null>(null);
  const [urlCol, setUrlCol] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const preview = useMemo(
    () =>
      sampleRows.slice(0, 6).map((cells) => {
        const price = priceCol != null ? parseIdr(cells[priceCol]) : null;
        return {
          name: cells[nameCol] ?? "",
          price,
          target: reversibleRmb(price, assumptions),
        };
      }),
    [sampleRows, nameCol, priceCol, assumptions]
  );

  function changeSheet(idx: number) {
    // Re-parse a different sheet by reloading the page with ?sheet=.
    router.push(
      `/competitors/${competitorId}/import?path=${encodeURIComponent(
        storagePath
      )}&file=${encodeURIComponent(fileName)}&sheet=${idx}`
    );
  }

  function doImport() {
    const mapping: ImportMapping = {
      sheetIndex: activeSheet,
      headerRowIdx,
      nameCol,
      priceCol,
      photoCol,
      specCol,
      urlCol,
    };
    start(async () => {
      try {
        const { inserted } = await importCompetitorProducts(
          competitorId,
          storagePath,
          fileName,
          mapping
        );
        toast.success(`Imported ${inserted} products`);
        router.push(`/competitors/${competitorId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  const colSelect = (
    value: number | null,
    onChange: (v: number | null) => void,
    allowNone: boolean
  ) => (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className="h-9 rounded-md border bg-transparent px-3 text-sm"
    >
      {allowNone ? <option value="">— none —</option> : null}
      {columns.map((c) => (
        <option key={c.index} value={c.index}>
          {c.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      {sheets.length > 1 ? (
        <div className="grid max-w-xs gap-1.5">
          <Label>Sheet</Label>
          <select
            value={activeSheet}
            onChange={(e) => changeSheet(Number(e.target.value))}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            {sheets.map((s) => (
              <option key={s.index} value={s.index}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-1.5">
          <Label>Product name column *</Label>
          {colSelect(nameCol, (v) => setNameCol(v ?? 0), false)}
        </div>
        <div className="grid gap-1.5">
          <Label>Price (IDR) column</Label>
          {colSelect(priceCol, setPriceCol, true)}
        </div>
        <div className="grid gap-1.5">
          <Label>Photo URL column</Label>
          {colSelect(photoCol, setPhotoCol, true)}
        </div>
        <div className="grid gap-1.5">
          <Label>Spec column</Label>
          {colSelect(specCol, setSpecCol, true)}
        </div>
        <div className="grid gap-1.5">
          <Label>Product URL column</Label>
          {colSelect(urlCol, setUrlCol, true)}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
          Preview
        </h2>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Their price</TableHead>
                <TableHead className="text-right">Target RMB</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{r.name || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.price != null
                      ? `Rp${Math.round(r.price).toLocaleString("id-ID")}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.target != null ? (
                      <span className="rounded bg-primary/10 px-2 py-1 font-semibold text-primary">
                        ¥{r.target.toFixed(2)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Check the product names and prices look right before importing.
        </p>
      </div>

      <Button onClick={doImport} disabled={pending} size="lg">
        {pending ? "Importing…" : "Import all products"}
      </Button>
    </div>
  );
}
