-- =============================================================================
-- CAA Procurement ERP — allow capturing a field quote before assigning a
--   supplier. The supplier can be filled in later from the Quotes Field list.
--   Run after 0013_quote_product_links.sql.
-- =============================================================================

alter table public.field_quotes
  alter column supplier_id drop not null;
