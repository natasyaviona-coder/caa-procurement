import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { UploadTrip } from "./upload-trip";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PastTripsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, name, selected_sheets, size_bytes, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Past Trips</h1>
          <p className="text-sm text-muted-foreground">
            Upload a trip workbook (REKAP + per-supplier sheets), pick the
            sheets, then click a trip to see its suppliers at a glance.
          </p>
        </div>
        {canWrite(profile.role) ? <UploadTrip /> : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trip</TableHead>
              <TableHead>Suppliers</TableHead>
              <TableHead className="text-right">Uploaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(trips ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No trips yet — upload one to start.
                </TableCell>
              </TableRow>
            ) : (
              trips!.map((t) => {
                const sheets = (t.selected_sheets ?? []) as {
                  index: number;
                  name: string;
                  kind: "supplier" | "other";
                }[];
                const suppliers = sheets.filter((s) => s.kind === "supplier");
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link
                        href={`/trips/${t.id}`}
                        className="font-medium hover:underline"
                      >
                        {t.name}
                      </Link>
                      {sheets.length === 0 ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (sheets not picked yet)
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {suppliers.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          suppliers.slice(0, 6).map((s) => (
                            <Badge
                              key={s.index}
                              className="bg-secondary text-secondary-foreground"
                            >
                              {s.name}
                            </Badge>
                          ))
                        )}
                        {suppliers.length > 6 ? (
                          <span className="text-xs text-muted-foreground">
                            +{suppliers.length - 6} more
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("id-ID")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
