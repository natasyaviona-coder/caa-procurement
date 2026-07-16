-- =============================================================================
-- CAA Procurement ERP — allow competitor products with no competitor yet, so
--   bulk-uploaded market screenshots can be saved and assigned to a competitor
--   later. Run after 0015_pricelist_translations.sql.
-- =============================================================================

alter table public.competitor_products
  alter column competitor_id drop not null;
