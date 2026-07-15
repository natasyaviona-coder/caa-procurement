-- =============================================================================
-- CAA Procurement ERP — Phase 1 schema
--   suppliers, products, supplier_quotes + profiles/roles for auth.
--   Run in the Supabase SQL editor, or via `supabase db push` if you use the CLI.
--   Idempotent where possible so re-running against an existing DB is safe.
-- =============================================================================

create extension if not exists pgcrypto;

-- ------------------------- Enums -------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'procurement', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contact_channel as enum ('wechat', 'phone', 'email', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.supplier_platform as enum ('1688', 'alibaba', 'direct_factory', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.brand as enum ('rumah_raya', 'surprice_store', 'other');
exception when duplicate_object then null; end $$;

-- ------------------------- Profiles ----------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  role       public.user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

-- Create a profile row on every new signup. Defaults to viewer; admin promotes manually.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- SECURITY DEFINER helper — used by RLS policies. Bypasses RLS on profiles to
-- avoid recursion when policies on other tables ask "what role am I?".
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Guard against role escalation via profile self-update.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role then
    if public.current_user_role() <> 'admin' then
      raise exception 'Only admins can change roles';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ------------------------- Suppliers ---------------------------------------
create table if not exists public.suppliers (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  contact_channel        public.contact_channel,
  contact_handle         text,
  platform               public.supplier_platform,
  payment_terms          text,
  typical_lead_time_days int,
  reliability_notes      text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists idx_suppliers_name on public.suppliers (lower(name));

-- ------------------------- Products ----------------------------------------
create table if not exists public.products (
  id                    uuid primary key default gen_random_uuid(),
  sku                   text not null unique,
  name                  text not null,
  brand                 public.brand,
  category              text,
  spec_summary          text,
  photo_url             text,
  current_stock_on_hand int  not null default 0,
  incoming_po_qty       int  not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_products_name on public.products (lower(name));
create index if not exists idx_products_sku  on public.products (lower(sku));

-- ------------------------- Supplier quotes ---------------------------------
-- product_id is nullable per CLAUDE.md section 12 open decision #3:
-- a quote can be logged before it's mapped to a product SKU.
create table if not exists public.supplier_quotes (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  rmb_price   numeric(12,4) not null check (rmb_price >= 0),
  moq         int check (moq is null or moq > 0),
  quote_date  date not null default current_date,
  valid_until date,
  notes       text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_quotes_supplier on public.supplier_quotes (supplier_id);
create index if not exists idx_quotes_product  on public.supplier_quotes (product_id);
create index if not exists idx_quotes_date     on public.supplier_quotes (quote_date desc);

-- ------------------------- updated_at trigger ------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_quotes_updated_at on public.supplier_quotes;
create trigger trg_quotes_updated_at
  before update on public.supplier_quotes
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row-Level Security
--   read: all authenticated users (viewer + procurement + admin)
--   insert/update: procurement + admin
--   delete: admin only
-- =============================================================================
alter table public.profiles        enable row level security;
alter table public.suppliers       enable row level security;
alter table public.products        enable row level security;
alter table public.supplier_quotes enable row level security;

-- ---- profiles --------------------------------------------------------------
drop policy if exists "profiles read all signed-in" on public.profiles;
create policy "profiles read all signed-in"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles admin update any" on public.profiles;
create policy "profiles admin update any"
  on public.profiles for update to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- ---- suppliers -------------------------------------------------------------
drop policy if exists "suppliers read"   on public.suppliers;
drop policy if exists "suppliers insert" on public.suppliers;
drop policy if exists "suppliers update" on public.suppliers;
drop policy if exists "suppliers delete" on public.suppliers;

create policy "suppliers read"
  on public.suppliers for select to authenticated using (true);
create policy "suppliers insert"
  on public.suppliers for insert to authenticated
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "suppliers update"
  on public.suppliers for update to authenticated
  using (public.current_user_role() in ('admin', 'procurement'))
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "suppliers delete"
  on public.suppliers for delete to authenticated
  using (public.current_user_role() = 'admin');

-- ---- products --------------------------------------------------------------
drop policy if exists "products read"   on public.products;
drop policy if exists "products insert" on public.products;
drop policy if exists "products update" on public.products;
drop policy if exists "products delete" on public.products;

create policy "products read"
  on public.products for select to authenticated using (true);
create policy "products insert"
  on public.products for insert to authenticated
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "products update"
  on public.products for update to authenticated
  using (public.current_user_role() in ('admin', 'procurement'))
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "products delete"
  on public.products for delete to authenticated
  using (public.current_user_role() = 'admin');

-- ---- supplier_quotes -------------------------------------------------------
drop policy if exists "quotes read"   on public.supplier_quotes;
drop policy if exists "quotes insert" on public.supplier_quotes;
drop policy if exists "quotes update" on public.supplier_quotes;
drop policy if exists "quotes delete" on public.supplier_quotes;

create policy "quotes read"
  on public.supplier_quotes for select to authenticated using (true);
create policy "quotes insert"
  on public.supplier_quotes for insert to authenticated
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "quotes update"
  on public.supplier_quotes for update to authenticated
  using (public.current_user_role() in ('admin', 'procurement'))
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "quotes delete"
  on public.supplier_quotes for delete to authenticated
  using (public.current_user_role() = 'admin');
