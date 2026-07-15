import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { CompetitorForm } from "../../competitor-form";
import { updateCompetitor } from "../../actions";

export default async function EditCompetitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  if (!canWrite(profile.role)) redirect(`/competitors/${id}`);

  const supabase = await createClient();
  const { data: competitor, error } = await supabase
    .from("competitors")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !competitor) notFound();

  const boundUpdate = async (formData: FormData) => {
    "use server";
    await updateCompetitor(id, formData);
    redirect(`/competitors/${id}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Edit competitor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update this competitor&apos;s details.
        </p>
      </div>
      <CompetitorForm
        initial={competitor}
        action={boundUpdate}
        submitLabel="Save changes"
      />
    </div>
  );
}
