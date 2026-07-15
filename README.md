# CAA Procurement ERP

Single source of truth for suppliers, products, and supplier quotes for
PT Chandra Anugrah Abadi (Rumah Raya, Surprice Store).

**Phase 1 only** — suppliers, products, quotes, auth + roles. Restock decisions
land in Phase 2. Do not build Phase 2 features here until Phase 1 has been used
daily and confirmed. See `../warehouse-dashboard/CLAUDE.md` for the full plan.

## Tech

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Tailwind v4** + **shadcn/ui**
- **Supabase** — Postgres, Auth, and Storage (Storage comes in Phase 3)
- Deploy target: Vercel

## Local setup

```bash
npm install
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
# open http://localhost:3000
```

## Supabase setup (one-time)

1. Create a new Supabase project at https://supabase.com/dashboard.
2. Copy **Project URL** and **anon public key** from *Project settings → API*
   into `.env.local`.
3. Open **SQL Editor** and run `supabase/migrations/0001_phase1_schema.sql`
   verbatim. It creates enums, tables, RLS policies, and the profile-on-signup
   trigger.
4. Create your admin user under **Authentication → Users → Add user → Create
   new user**. Set email to `natasyaviona@gmail.com` (or whatever you use to
   sign in) and set a password. Auto-confirm the email so no verification link
   is needed.
5. Promote yourself to admin — every new signup lands as `viewer` by design.
   In SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where email = 'natasyaviona@gmail.com';
   ```
6. Sign in at `/login`.

### Adding more users later (Phases 1–3)

Per section 7 of the project plan, **only the admin is provisioned at launch.**
Don't invite Procurement or Viewer until Phases 1–3 have been in daily use.

When you do, create the user in Supabase Auth as above, then set their role:
```sql
update public.profiles set role = 'procurement' where email = 'someone@example.com';
```

## Roles

| Role         | Read | Insert/Update | Delete |
| ------------ | ---- | ------------- | ------ |
| viewer       | Yes  | No            | No     |
| procurement  | Yes  | Yes           | No     |
| admin        | Yes  | Yes           | Yes    |

RLS enforces this at the database level. The UI hides write buttons for
non-writers, and server actions re-check as defense in depth.

## Project structure

```
supabase/
  migrations/0001_phase1_schema.sql   ← source of truth for the DB
src/
  middleware.ts                       ← redirects unauthenticated → /login
  lib/
    supabase/{client,server,middleware}.ts
    auth.ts                           ← requireProfile(), canWrite(), isAdmin()
    types/database.ts                 ← hand-written now, regenerate later
    enums.ts                          ← labels for DB enums
  app/
    layout.tsx                        ← root, fonts + metadata
    login/                            ← unauth pages
    auth/callback/                    ← Supabase email-link handler
    (app)/                            ← protected group (auth required)
      layout.tsx                      ← app shell + nav
      page.tsx                        ← dashboard
      suppliers/
      products/
      quotes/
  components/
    app-nav.tsx
    ui/                               ← shadcn components
```

## Next steps (not for this phase — do NOT build ahead)

- **Phase 2:** `restock_decisions` table + computed fields + Restock Now/Plan
  Soon/OK dashboard. Wire the existing Excel logic in.
- **Phase 3:** `competitor_prices` + linkage.
- **Photo bulk import** (per CLAUDE.md section 6): a separate script that
  unzips supplier `.xlsx` files, reads `xl/drawings/drawingN.xml` for image
  anchors, uploads to Supabase Storage, and upserts `products.photo_url`.
  Not part of the deployed app. Lives outside `src/`.
