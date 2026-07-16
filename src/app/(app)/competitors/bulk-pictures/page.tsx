import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, canWrite } from "@/lib/auth";
import { LinkButton } from "@/components/link-button";
import { BulkPictures } from "./bulk-pictures";

export default async function BulkPicturesPage() {
  const profile = await requireProfile();
  if (!canWrite(profile.role)) redirect("/competitors");

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("fx_rate_rmb_idr, default_admin_pct, default_target_margin_pct")
    .eq("id", 1)
    .maybeSingle();

  const s = {
    fx: settings?.fx_rate_rmb_idr ? Number(settings.fx_rate_rmb_idr) : 2700,
    admin: settings?.default_admin_pct != null ? Number(settings.default_admin_pct) : 0.3,
    margin:
      settings?.default_target_margin_pct != null
        ? Number(settings.default_target_margin_pct)
        : 0.1,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Bulk upload pictures
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Drop in marketplace screenshots. Each is analyzed for product name,
            price, size, and a cropped photo, with the sourcing RMB reverse-costed.
            Review and edit, then Save all — they land as unassigned competitor
            products to file under a competitor afterwards.
          </p>
        </div>
        <LinkButton href="/competitors" variant="outline">
          Back
        </LinkButton>
      </div>

      <BulkPictures settings={s} />
    </div>
  );
}
