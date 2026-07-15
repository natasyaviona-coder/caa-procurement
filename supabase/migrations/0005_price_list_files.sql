-- =============================================================================
-- CAA Procurement ERP — uploaded price-list files
--   Metadata table + private storage bucket so price lists can be uploaded
--   and viewed inside the app. Run after 0004_quotes_source_file.sql.
-- =============================================================================

-- ------------------------- Metadata table -----------------------------------
create table if not exists public.price_list_files (
  id           uuid primary key default gen_random_uuid(),
  file_name    text not null,
  storage_path text not null unique,
  size_bytes   bigint,
  uploaded_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_price_list_files_created
  on public.price_list_files (created_at desc);

alter table public.price_list_files enable row level security;

drop policy if exists "files read"   on public.price_list_files;
drop policy if exists "files insert" on public.price_list_files;
drop policy if exists "files delete" on public.price_list_files;

create policy "files read"
  on public.price_list_files for select to authenticated using (true);
create policy "files insert"
  on public.price_list_files for insert to authenticated
  with check (public.current_user_role() in ('admin', 'procurement'));
create policy "files delete"
  on public.price_list_files for delete to authenticated
  using (public.current_user_role() = 'admin');

-- ------------------------- Storage bucket -----------------------------------
-- Private bucket: files are internal supplier data. The app reads them
-- server-side with the signed-in user's session (covered by the read policy
-- below); nothing is publicly reachable by URL.
insert into storage.buckets (id, name, public)
values ('price-lists', 'price-lists', false)
on conflict (id) do nothing;

drop policy if exists "price-lists read"   on storage.objects;
drop policy if exists "price-lists insert" on storage.objects;
drop policy if exists "price-lists delete" on storage.objects;

create policy "price-lists read"
  on storage.objects for select to authenticated
  using (bucket_id = 'price-lists');
create policy "price-lists insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'price-lists'
    and public.current_user_role() in ('admin', 'procurement')
  );
create policy "price-lists delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'price-lists'
    and public.current_user_role() = 'admin'
  );
