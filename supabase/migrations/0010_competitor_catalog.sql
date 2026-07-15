-- =============================================================================
-- CAA Procurement ERP — Competitors as catalogs
--   A competitor is now an entity (name + specialization) with an uploaded
--   product list. "Reversible RMB" (target sourcing price) is computed on read
--   from settings, so nothing about it is stored per row.
--   Run after 0009_trips_source_url.sql.
--
--   The older per-product `competitor_prices` table is intentionally left in
--   place (data preserved); it is simply no longer written from the UI.
-- =============================================================================

-- Reverse-RMB assumptions live in settings so they're admin-editable in one place.
alter table public.settings
  add column if not exists default_admin_pct         numeric(6,4) not null default 0.30,
  add column if not exists default_target_margin_pct numeric(6,4) not null default 0.30;

-- ------------------------- Competitors -------------------------------------
create table if not exists public.competitors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  specialization text,          -- e.g. "panci", "pisau"
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_competitors_name on public.competitors (lower(name));

drop trigger if exists trg_competitors_updated_at on public.competitors;
create trigger trg_competitors_updated_at
  before update on public.competitors
  for each row execute function public.set_updated_at();

alter table public.competitors enable row level security;

drop policy if exists "competitors read"   on public.competitors;
drop policy if exists "competitors insert" on public.competitors;
drop policy if exists "competitors update" on public.competitors;
drop policy if exists "competitors delete" on public.competitors;

create policy "competitors read"
  on public.competitors for select to authenticated using (true);
create policy "competitors insert"
  on public.competitors for insert to authenticated
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "competitors update"
  on public.competitors for update to authenticated
  using (public.current_user_role() in ('admin', 'procurement'))
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "competitors delete"
  on public.competitors for delete to authenticated
  using (public.current_user_role() = 'admin');

-- ------------------------- Competitor products ------------------------------
create table if not exists public.competitor_products (
  id            uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  name          text not null,
  price_idr     numeric(14,2),   -- competitor's selling price
  photo_url     text,
  spec_summary  text,
  product_url   text,
  source_file   text,            -- which uploaded file this row came from
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_comp_products_competitor
  on public.competitor_products (competitor_id);
create index if not exists idx_comp_products_name
  on public.competitor_products (lower(name));

drop trigger if exists trg_comp_products_updated_at on public.competitor_products;
create trigger trg_comp_products_updated_at
  before update on public.competitor_products
  for each row execute function public.set_updated_at();

alter table public.competitor_products enable row level security;

drop policy if exists "comp_products read"   on public.competitor_products;
drop policy if exists "comp_products insert" on public.competitor_products;
drop policy if exists "comp_products update" on public.competitor_products;
drop policy if exists "comp_products delete" on public.competitor_products;

create policy "comp_products read"
  on public.competitor_products for select to authenticated using (true);
create policy "comp_products insert"
  on public.competitor_products for insert to authenticated
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "comp_products update"
  on public.competitor_products for update to authenticated
  using (public.current_user_role() in ('admin', 'procurement'))
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "comp_products delete"
  on public.competitor_products for delete to authenticated
  using (public.current_user_role() in ('admin', 'procurement'));
