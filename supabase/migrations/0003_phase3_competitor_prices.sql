-- =============================================================================
-- CAA Procurement ERP — Phase 3 schema
--   competitor_prices, feeding competitor_price_best_match into restock.
--   Run after 0002_phase2_restock.sql. Idempotent where possible.
-- =============================================================================

-- ------------------------- Enums -------------------------------------------
do $$ begin
  create type public.competitor_platform as enum ('TikTok Shop', 'Shopee', 'Other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.spec_match as enum ('Same', 'Similar', 'Different');
exception when duplicate_object then null; end $$;

-- ------------------------- Competitor prices --------------------------------
-- photo_url is a plain text URL (paste-a-link), per CLAUDE.md section 6 —
-- no in-app upload widget in this phase.
create table if not exists public.competitor_prices (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products(id) on delete cascade,
  competitor_seller text,
  platform          public.competitor_platform,
  photo_url         text,
  spec_summary      text,
  spec_match        public.spec_match,
  price             numeric(14,2) not null check (price >= 0),
  product_url       text,
  date_checked      date not null default current_date,
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_competitor_product on public.competitor_prices (product_id);
-- Partial index: best-match lookups only ever scan spec_match = 'Same' rows.
create index if not exists idx_competitor_best_match
  on public.competitor_prices (product_id, price)
  where spec_match = 'Same';
create index if not exists idx_competitor_date on public.competitor_prices (date_checked desc);

drop trigger if exists trg_competitor_updated_at on public.competitor_prices;
create trigger trg_competitor_updated_at
  before update on public.competitor_prices
  for each row execute function public.set_updated_at();

alter table public.competitor_prices enable row level security;

drop policy if exists "competitor read"   on public.competitor_prices;
drop policy if exists "competitor insert" on public.competitor_prices;
drop policy if exists "competitor update" on public.competitor_prices;
drop policy if exists "competitor delete" on public.competitor_prices;

create policy "competitor read"
  on public.competitor_prices for select to authenticated using (true);
create policy "competitor insert"
  on public.competitor_prices for insert to authenticated
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "competitor update"
  on public.competitor_prices for update to authenticated
  using (public.current_user_role() in ('admin', 'procurement'))
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "competitor delete"
  on public.competitor_prices for delete to authenticated
  using (public.current_user_role() = 'admin');
