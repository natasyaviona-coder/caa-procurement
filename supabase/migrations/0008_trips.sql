-- =============================================================================
-- CAA Procurement ERP — Past Trips
--   One row per uploaded trip workbook (REKAP + per-supplier sheets).
--   Files reuse the private 'price-lists' storage bucket under trips/…,
--   so no new storage policies are needed. Run after 0007_field_quotes.sql.
-- =============================================================================

create table if not exists public.trips (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  storage_path  text not null unique,
  size_bytes    bigint,
  -- Which sheets of the workbook are included, and how each is classified:
  -- [{"index": 0, "name": "REKAP", "kind": "other"},
  --  {"index": 1, "name": "FEI",   "kind": "supplier"}]
  selected_sheets jsonb not null default '[]'::jsonb,
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_trips_created on public.trips (created_at desc);

drop trigger if exists trg_trips_updated_at on public.trips;
create trigger trg_trips_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

alter table public.trips enable row level security;

drop policy if exists "trips read"   on public.trips;
drop policy if exists "trips insert" on public.trips;
drop policy if exists "trips update" on public.trips;
drop policy if exists "trips delete" on public.trips;

create policy "trips read"
  on public.trips for select to authenticated using (true);
create policy "trips insert"
  on public.trips for insert to authenticated
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "trips update"
  on public.trips for update to authenticated
  using (public.current_user_role() in ('admin', 'procurement'))
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "trips delete"
  on public.trips for delete to authenticated
  using (public.current_user_role() = 'admin');
