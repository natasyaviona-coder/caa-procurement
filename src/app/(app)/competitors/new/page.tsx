import { redirect } from "next/navigation";
import { requireProfile, canWrite } from "@/lib/auth";
import { CompetitorForm } from "../competitor-form";
import { createCompetitor } from "../actions";

export default async function NewCompetitorPage() {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) redirect("/competitors");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">New competitor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a market seller to benchmark your sourcing against.
        </p>
      </div>
      <CompetitorForm action={createCompetitor} submitLabel="Create competitor" />
    </div>
  );
}
