import { createBrowserClient } from "@supabase/ssr";

// Database generic omitted intentionally — regenerate strict types with
//   npx supabase gen types typescript --project-id <ref> --schema public > src/lib/types/database.ts
// then thread <Database> through here for full type safety on queries.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
