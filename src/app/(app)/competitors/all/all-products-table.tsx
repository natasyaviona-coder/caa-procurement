"use client";

import { useState } from "react";
import Link from "next/link";

export type AllProduct = {
  id: string;
  name: string;
  competitorId: string | null;
  competitorName: string | null;
  photoUrl: string | null;
  price: string;
  sold: string;
  targetRmb: string;
  size: string;
};

function firstWord(name: string | null): string {
  const w = (name ?? "").trim().split(/\s+/)[0];
  return w || "—";
}

export function AllProductsTable({ products }: { products: AllProduct[] }) {
  const [selected, setSelected] = useState<AllProduct | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full table-fixed text-xs">
          <thead className="bg-muted/50 text-[11px] text-muted-foreground">
            <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th className="w-11" />
              <th>Product</th>
              <th className="w-16">Seller</th>
              <th className="w-16 text-right">Price</th>
              <th className="hidden w-12 text-right sm:table-cell">Sold</th>
              <th className="w-14 text-right">¥ RMB</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-8 text-center text-muted-foreground">
                  No products.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="cursor-pointer border-t align-top transition-colors hover:bg-muted/40 [&>td]:px-2 [&>td]:py-2"
                >
                  <td className="w-11">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photoUrl}
                        alt=""
                        loading="lazy"
                        className="h-9 w-9 rounded border object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded bg-muted" />
                    )}
                  </td>
                  <td className="font-medium">
                    <span className="line-clamp-2 break-words">{p.name}</span>
                  </td>
                  <td className="text-muted-foreground">
                    <span className="line-clamp-1 break-words">
                      {p.competitorId ? firstWord(p.competitorName) : "—"}
                    </span>
                  </td>
                  <td className="truncate text-right tabular-nums">{p.price}</td>
                  <td className="hidden truncate text-right tabular-nums sm:table-cell">
                    {p.sold}
                  </td>
                  <td className="truncate bg-yellow-100 text-right font-semibold tabular-nums text-yellow-950">
                    {p.targetRmb}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-xl bg-background p-4 shadow-xl sm:rounded-xl"
          >
            {selected.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.photoUrl}
                alt=""
                className="mx-auto max-h-56 rounded-md border object-contain"
              />
            ) : null}
            <h3 className="mt-3 text-sm font-medium whitespace-pre-line break-words">
              {selected.name}
            </h3>
            <p className="mt-0.5 text-xs">
              {selected.competitorId ? (
                <Link
                  href={`/competitors/${selected.competitorId}`}
                  className="text-brand hover:underline"
                >
                  {selected.competitorName}
                </Link>
              ) : (
                <span className="text-muted-foreground">— unassigned —</span>
              )}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3">
              <Detail label="Price" value={selected.price} />
              <Detail label="Sold" value={selected.sold} />
              <Detail label="Target RMB (¥)" value={selected.targetRmb} highlight />
              <Detail label="Size" value={selected.size || "—"} />
            </dl>

            <div className="mt-5 flex justify-end gap-2">
              {selected.competitorId ? (
                <Link
                  href={`/competitors/${selected.competitorId}`}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Open competitor
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Detail({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd
        className={
          "text-sm tabular-nums " +
          (highlight ? "font-semibold text-yellow-700" : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}
