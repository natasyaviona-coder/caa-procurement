"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Visible gridlines on every cell.
const GRID = "[&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border";

// Columns shown as Indonesian-formatted whole numbers: 100.000, no decimals.
const IDR_KEYS = new Set(["hpp_produk", "ongkir", "hpp_landed"]);

function parseNum(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function formatIdr(v: string | undefined): string {
  const n = parseNum(v);
  if (n == null) return "—";
  return Math.round(n).toLocaleString("id-ID");
}

export type StdColumn = { key: string; label: string };
export type StdRow = {
  rowNum: number;
  hasImage: boolean;
  values: Record<string, string>;
};

export function StandardizedTable({
  fileId,
  sheetIndex,
  columns,
  rows,
  translations = {},
}: {
  fileId: string;
  sheetIndex: number;
  columns: StdColumn[];
  rows: StdRow[];
  translations?: Record<string, string>;
}) {
  // Est. sell price per row — calculator state only, never saved.
  const [sellPrices, setSellPrices] = useState<Record<number, string>>({});

  function marginFor(row: StdRow): { text: string; negative: boolean } | null {
    const sell = parseNum(sellPrices[row.rowNum]);
    const hpp = parseNum(row.values.hpp_landed);
    if (sell == null || sell <= 0 || hpp == null) return null;
    const pct = ((sell - hpp) / sell) * 100;
    return { text: `${pct.toFixed(1)}%`, negative: pct < 0 };
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className={GRID}>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap font-semibold">
              Product Image
            </TableHead>
            {columns.map((c) => (
              <TableHead key={c.key} className="whitespace-nowrap font-semibold">
                {c.label}
              </TableHead>
            ))}
            <TableHead className="whitespace-nowrap bg-muted/50 font-semibold">
              Est. Sell Price (IDR)
            </TableHead>
            <TableHead className="whitespace-nowrap bg-muted/50 font-semibold">
              Profit Margin
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + 3}
                className="text-center text-muted-foreground"
              >
                No data rows.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const margin = marginFor(row);
              return (
                <TableRow key={row.rowNum}>
                  <TableCell className="w-20">
                    {row.hasImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/quotes/files/${fileId}/image/${row.rowNum}?sheet=${sheetIndex}`}
                        alt=""
                        loading="lazy"
                        className="h-16 w-16 rounded object-contain"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded bg-muted" />
                    )}
                  </TableCell>
                  {columns.map((c) => {
                    const en =
                      c.key === "name" ? translations[String(row.rowNum)] : undefined;
                    return (
                      <TableCell
                        key={c.key}
                        className={cn(
                          "max-w-56 text-xs",
                          IDR_KEYS.has(c.key) && "text-right tabular-nums"
                        )}
                      >
                        {IDR_KEYS.has(c.key) ? (
                          formatIdr(row.values[c.key])
                        ) : c.key === "name" && en ? (
                          <div className="space-y-0.5">
                            <div>{en}</div>
                            <div className="text-[11px] whitespace-pre-line text-muted-foreground">
                              {row.values.name}
                            </div>
                          </div>
                        ) : (
                          row.values[c.key] || "—"
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="bg-muted/30">
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={sellPrices[row.rowNum] ?? ""}
                      onChange={(e) =>
                        setSellPrices((prev) => ({
                          ...prev,
                          [row.rowNum]: e.target.value,
                        }))
                      }
                      className="h-8 w-28 text-right text-xs tabular-nums"
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "bg-muted/30 text-right text-xs font-medium tabular-nums",
                      margin?.negative && "text-destructive"
                    )}
                  >
                    {margin?.text ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
