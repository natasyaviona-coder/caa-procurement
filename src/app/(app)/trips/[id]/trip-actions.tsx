"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { deleteTrip, refreshTripFromSource } from "../actions";

export function TripActions({
  tripId,
  tripName,
  canDelete,
  hasSource,
}: {
  tripId: string;
  tripName: string;
  canDelete: boolean;
  hasSource: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function refresh() {
    start(async () => {
      try {
        await refreshTripFromSource(tripId);
        toast.success("Refreshed from Google Sheet");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Refresh failed");
      }
    });
  }

  function remove() {
    if (
      !window.confirm(
        `Delete trip "${tripName}"?\n\nThis removes the uploaded workbook from the app.`
      )
    ) {
      return;
    }
    start(async () => {
      try {
        await deleteTrip(tripId);
        toast.success("Trip deleted");
        router.push("/trips");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasSource ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={refresh}>
          {pending ? "Refreshing…" : "Refresh from Google Sheet"}
        </Button>
      ) : null}
      <LinkButton href={`/trips/${tripId}?edit=1`} variant="outline" size="sm">
        Edit sheets
      </LinkButton>
      {canDelete ? (
        <Button size="sm" variant="destructive" disabled={pending} onClick={remove}>
          Delete trip
        </Button>
      ) : null}
    </div>
  );
}
