-- =============================================================================
-- CAA Procurement ERP — Quotes Field (in-person supplier visits)
--   Photo-based quick quotes captured at the supplier, with a costing
--   assumptions snapshot per entry. Run after 0006_files_supplier.sql.
-- =============================================================================

-- Business card photo lives on the supplier itself.
alter table public.suppliers
  add column if not exists business_card_url text;

create table if not exists public.field_quotes (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references public.suppliers(id) on delete cascade,
  product_name    text,
  photo_url       text,
  price_rmb       numeric(12,4),
  qty_per_carton  int,
  -- carton dimensions in cm (used to derive CBM when cbm is not given directly)
  carton_p_cm     numeric(10,2),
  carton_l_cm     numeric(10,2),
  carton_t_cm     numeric(10,2),
  cbm             numeric(12,6),
  -- product size in cm (informational)
  size_p_cm       numeric(10,2),
  size_l_cm       numeric(10,2),
  size_t_cm       numeric(10,2),
  -- assumptions snapshot (editable per entry; defaults mirror the FEI workbook)
  fx_rate         numeric(12,4) not null default 2700,
  freight_per_cbm numeric(14,2) not null default 4500000,
  admin_pct       numeric(6,4)  not null default 0.30,
  order_fee       numeric(14,2) not null default 1250,
  packaging_fee   numeric(14,2) not null default 2000,
  est_sell_price  numeric(14,2),
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_field_quotes_supplier
  on public.field_quotes (supplier_id, created_at desc);

drop trigger if exists trg_field_quotes_updated_at on public.field_quotes;
create trigger trg_field_quotes_updated_at
  before update on public.field_quotes
  for each row execute function public.set_updated_at();

alter table public.field_quotes enable row level security;

drop policy if exists "field_quotes read"   on public.field_quotes;
drop policy if exists "field_quotes insert" on public.field_quotes;
drop policy if exists "field_quotes update" on public.field_quotes;
drop policy if exists "field_quotes delete" on public.field_quotes;

create policy "field_quotes read"
  on public.field_quotes for select to authenticated using (true);
create policy "field_quotes insert"
  on public.field_quotes for insert to authenticated
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "field_quotes update"
  on public.field_quotes for update to authenticated
  using (public.current_user_role() in ('admin', 'procurement'))
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "field_quotes delete"
  on public.field_quotes for delete to authenticated
  using (public.current_user_role() = 'admin');

-- Public bucket so photo_url renders directly in <img> (same as product-photos).
insert into storage.buckets (id, name, public)
values ('field-photos', 'field-photos', true)
on conflict (id) do nothing;

drop policy if exists "field-photos read"   on storage.objects;
drop policy if exists "field-photos insert" on storage.objects;
drop policy if exists "field-photos delete" on storage.objects;

create policy "field-photos read"
  on storage.objects for select to authenticated
  using (bucket_id = 'field-photos');
create policy "field-photos insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'field-photos'
    and public.current_user_role() in ('admin', 'procurement')
  );
create policy "field-photos delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'field-photos'
    and public.current_user_role() = 'admin'
  );
