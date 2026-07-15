-- =============================================================================
-- CAA Procurement ERP — link quotes + competitor products to a shared product
--   Lets you compare "the same product" across suppliers and against the
--   market. supplier_quotes already has product_id; this adds it to
--   field_quotes and competitor_products. Run after 0012_supplier_address.sql.
-- =============================================================================

alter table public.field_quotes
  add column if not exists product_id uuid references public.products(id) on delete set null;
create index if not exists idx_field_quotes_product on public.field_quotes (product_id);

alter table public.competitor_products
  add column if not exists product_id uuid references public.products(id) on delete set null;
create index if not exists idx_comp_products_product on public.competitor_products (product_id);
