"use client";

import { useTransition } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { importSuppliers, type SupplierImportMapping } from "../actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Column = { index: number; label: string };

export function SupplierMappingForm({
  storagePath,
  fileName,
  sheetIndex,
  columns,
  headerRowIdx,
  sampleRows,
  guess,
}: {
  storagePath: string;
  fileName: string;
  sheetIndex: number;
  columns: Column[];
  headerRowIdx: number;
  sampleRows: string[][];
  guess: {
    nameCol: number;
    contactCol: number | null;
    leadTimeCol: number | null;
    paymentCol: number | null;
    addressCol: number | null;
  };
}) {
  const [nameCol, setNameCol] = useState(guess.nameCol);
  const [contactCol, setContactCol] = useState(guess.contactCol);
  const [leadTimeCol, setLeadTimeCol] = useState(guess.leadTimeCol);
  const [paymentCol, setPaymentCol] = useState(guess.paymentCol);
  const [addressCol, setAddressCol] = useState(guess.addressCol);
  const [pending, start] = useTransition();
  const router = useRouter();

  function doImport() {
    const mapping: SupplierImportMapping = {
      sheetIndex,
      headerRowIdx,
      nameCol,
      contactCol,
      leadTimeCol,
      paymentCol,
      addressCol,
    };
    start(async () => {
      try {
        const { inserted, cards } = await importSuppliers(storagePath, fileName, mapping);
        toast.success(`Imported ${inserted} suppliers (${cards} business cards)`);
        router.push("/suppliers");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  const sel = (
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
      <p className="text-sm text-muted-foreground">
        Map the columns. The business card photo (kartu nama) is read from each
        row&apos;s embedded image automatically — no column needed.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-1.5">
          <Label>Name *</Label>
          {sel(nameCol, (v) => setNameCol(v ?? 0), false)}
        </div>
        <div className="grid gap-1.5">
          <Label>Contact</Label>
          {sel(contactCol, setContactCol, true)}
        </div>
        <div className="grid gap-1.5">
          <Label>Lead time (days)</Label>
          {sel(leadTimeCol, setLeadTimeCol, true)}
        </div>
        <div className="grid gap-1.5">
          <Label>TOP / Cash (payment terms)</Label>
          {sel(paymentCol, setPaymentCol, true)}
        </div>
        <div className="grid gap-1.5">
          <Label>Address</Label>
          {sel(addressCol, setAddressCol, true)}
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
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Lead time</TableHead>
                <TableHead>TOP / Cash</TableHead>
                <TableHead>Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleRows.slice(0, 6).map((cells, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{cells[nameCol] || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {contactCol != null ? cells[contactCol] || "—" : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {leadTimeCol != null ? cells[leadTimeCol] || "—" : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {paymentCol != null ? cells[paymentCol] || "—" : "—"}
                  </TableCell>
                  <TableCell className="max-w-52 truncate text-xs">
                    {addressCol != null ? cells[addressCol] || "—" : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Button onClick={doImport} disabled={pending} size="lg">
        {pending ? "Importing…" : "Import suppliers"}
      </Button>
    </div>
  );
}
