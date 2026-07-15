-- =============================================================================
-- CAA Procurement ERP — add source_file to supplier_quotes
--   Lets bulk-imported quotes be filtered/grouped by which price-list file
--   they came from. Run after 0003_phase3_competitor_prices.sql.
-- =============================================================================

alter table public.supplier_quotes
  add column if not exists source_file text;

create index if not exists idx_quotes_source_file
  on public.supplier_quotes (source_file)
  where source_file is not null;
