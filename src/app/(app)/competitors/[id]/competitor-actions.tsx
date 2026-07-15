"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { deleteCompetitor, deleteCompetitorProduct } from "../actions";
import { UploadProducts } from "./upload-products";

export function CompetitorHeaderActions({
  competitorId,
  competitorName,
  canDelete,
}: {
  competitorId: string;
  competitorName: string;
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function remove() {
    if (
      !window.confirm(
        `Delete "${competitorName}" and all their products?\n\nThis cannot be undone.`
      )
    ) {
      return;
    }
    start(async () => {
      try {
        await deleteCompetitor(competitorId);
        toast.success("Competitor deleted");
        router.push("/competitors");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <UploadProducts competitorId={competitorId} />
      <LinkButton href={`/competitors/${competitorId}/edit`} variant="outline" size="sm">
        Edit
      </LinkButton>
      {canDelete ? (
        <Button size="sm" variant="destructive" disabled={pending} onClick={remove}>
          Delete
        </Button>
      ) : null}
    </div>
  );
}

// Small inline delete for a single product row.
export function DeleteProductButton({
  productId,
  competitorId,
}: {
  productId: string;
  competitorId: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  return confirming ? (
    <span className="flex items-center gap-1">
      <Button
        size="xs"
        variant="destructive"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              await deleteCompetitorProduct(productId, competitorId);
              toast.success("Removed");
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            }
          })
        }
      >
        Confirm
      </Button>
      <Button size="xs" variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  ) : (
    <Button size="xs" variant="ghost" onClick={() => setConfirming(true)}>
      Remove
    </Button>
  );
}
