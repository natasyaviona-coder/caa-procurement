-- =============================================================================
-- CAA Procurement ERP — competitor products: store the full template row
--   The competitor pricing template (BMW Kitchenware style) already computes
--   Reverse RMB in the sheet and carries several descriptive columns. Store
--   them verbatim as `fields` so the app can render the file faithfully.
--   Run after 0010_competitor_catalog.sql.
-- =============================================================================

alter table public.competitor_products
  add column if not exists fields jsonb not null default '{}'::jsonb;
