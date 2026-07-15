import { createClient } from "@/lib/supabase/server";
import { requireProfile, isAdmin } from "@/lib/auth";
import { SettingsForm } from "./settings-form";
import { updateSettings } from "./actions";
import { formatPct } from "@/lib/format";

export default async function SettingsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: settings, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !settings) {
    return (
      <p className="text-sm text-destructive">
        Could not load settings: {error?.message ?? "no settings row found"}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Global assumptions used across restock costing calculations. Individual
          restock decisions can override these per-product.
        </p>
      </div>
      {isAdmin(profile.role) ? (
        <SettingsForm initial={settings} action={updateSettings} />
      ) : (
        <dl className="grid max-w-xl gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-muted-foreground">FX rate (RMB → IDR)</dt>
            <dd className="text-sm">{settings.fx_rate_rmb_idr}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Default safety stock</dt>
            <dd className="text-sm">{settings.default_safety_stock_days} days</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Default import duty</dt>
            <dd className="text-sm">{formatPct(settings.default_import_duty_pct)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Container CBM cap</dt>
            <dd className="text-sm">{settings.container_cbm_cap ?? "—"}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
