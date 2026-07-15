import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

export type CurrentProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
};

// Returns the signed-in user's profile, or redirects to /login.
// Also useful as a defense-in-depth check inside server actions.
export async function requireProfile(): Promise<CurrentProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Signed-in user without a profile row — shouldn't happen (trigger creates one),
    // but if it does, treat as unauthorised.
    redirect("/login?error=No+profile+found");
  }
  return profile;
}

export function canWrite(role: UserRole) {
  return role === "admin" || role === "procurement";
}

export function isAdmin(role: UserRole) {
  return role === "admin";
}
