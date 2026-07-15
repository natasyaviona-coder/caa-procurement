-- =============================================================================
-- CAA Procurement ERP — Phase 2 schema
--   restock_decisions + settings, with role-gated approval workflow.
--   Run after 0001_phase1_schema.sql. Idempotent where possible.
-- =============================================================================

-- ------------------------- Enums -------------------------------------------
do $$ begin
  create type public.assumption_basis as enum (
    'Historical Restock Data',
    'Competitor Benchmark',
    'Affiliate Campaign Projection',
    'Wild Assumption'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.confidence_level as enum ('High', 'Medium', 'Low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.decision_status as enum ('Needs Review', 'Approve', 'Hold', 'Reject');
exception when duplicate_object then null; end $$;

-- ------------------------- Settings (singleton row) -------------------------
create table if not exists public.settings (
  id                        smallint primary key default 1,
  fx_rate_rmb_idr           numeric(12,4) not null default 2200,
  default_safety_stock_days int not null default 7,
  default_import_duty_pct   numeric(6,4) not null default 0.15,
  container_cbm_cap         numeric(10,2),
  updated_at                timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.settings enable row level security;

drop policy if exists "settings read"   on public.settings;
drop policy if exists "settings update" on public.settings;

create policy "settings read"
  on public.settings for select to authenticated using (true);
create policy "settings update"
  on public.settings for update to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ------------------------- Restock decisions ---------------------------------
create table if not exists public.restock_decisions (
  id                                 uuid primary key default gen_random_uuid(),
  product_id                         uuid not null references public.products(id) on delete cascade,
  sales_velocity_1mo                 int,
  sales_velocity_3mo_avg             int,
  lead_time_days                     int,
  safety_stock_days_override         int,
  fx_rate_override                   numeric(12,4),
  ongkir_per_unit                    numeric(12,4),
  import_duty_pct_override           numeric(6,4),
  target_harga_jual                  numeric(14,2),
  proposed_qty                       int,
  assumption_basis                   public.assumption_basis,
  confidence_level                   public.confidence_level,
  assumed_monthly_sales_post_restock int,
  notes                              text,
  decision_status                    public.decision_status not null default 'Needs Review',
  approved_by                        uuid references auth.users(id) on delete set null,
  created_at                         timestamptz not null default now(),
  updated_at                         timestamptz not null default now()
);
create index if not exists idx_restock_product on public.restock_decisions (product_id, created_at desc);
create index if not exists idx_restock_status  on public.restock_decisions (decision_status);

drop trigger if exists trg_restock_updated_at on public.restock_decisions;
create trigger trg_restock_updated_at
  before update on public.restock_decisions
  for each row execute function public.set_updated_at();

-- Only admins may set/keep decision_status = 'Approve'; approved_by is
-- auto-stamped on approval and cleared whenever status isn't 'Approve',
-- so it can never be forged or left stale via a direct field update.
create or replace function public.enforce_restock_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_already_approved boolean := false;
begin
  if tg_op = 'UPDATE' then
    was_already_approved := (old.decision_status = 'Approve');
  end if;

  if new.decision_status = 'Approve' then
    if public.current_user_role() <> 'admin' then
      raise exception 'Only admins can approve restock decisions';
    end if;
    if not was_already_approved then
      new.approved_by := auth.uid();
    end if;
  else
    new.approved_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_restock_approval on public.restock_decisions;
create trigger trg_restock_approval
  before insert or update on public.restock_decisions
  for each row execute function public.enforce_restock_approval();

alter table public.restock_decisions enable row level security;

drop policy if exists "restock read"   on public.restock_decisions;
drop policy if exists "restock insert" on public.restock_decisions;
drop policy if exists "restock update" on public.restock_decisions;
drop policy if exists "restock delete" on public.restock_decisions;

create policy "restock read"
  on public.restock_decisions for select to authenticated using (true);
create policy "restock insert"
  on public.restock_decisions for insert to authenticated
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "restock update"
  on public.restock_decisions for update to authenticated
  using (public.current_user_role() in ('admin', 'procurement'))
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "restock delete"
  on public.restock_decisions for delete to authenticated
  using (public.current_user_role() = 'admin');
