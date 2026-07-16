-- =============================================================================
-- CAA Procurement ERP — store English translations of a price-list file's
--   Chinese product names, keyed by sheet index → row number. Lets the Quotes
--   File viewer show English in-app without regenerating the workbook.
--   Run after 0014_field_quotes_optional_supplier.sql.
-- =============================================================================

alter table public.price_list_files
  add column if not exists translations jsonb not null default '{}'::jsonb;
