-- =============================================================================
-- CAA Procurement ERP — link uploaded price-list files to a supplier
--   Run after 0005_price_list_files.sql.
-- =============================================================================

alter table public.price_list_files
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create index if not exists idx_price_list_files_supplier
  on public.price_list_files (supplier_id);
