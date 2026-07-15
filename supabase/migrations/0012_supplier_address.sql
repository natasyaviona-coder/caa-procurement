-- =============================================================================
-- CAA Procurement ERP — supplier address
--   Adds a plain-text address to suppliers (business card / manual entry /
--   xlsx import). Run after 0011_competitor_template.sql.
-- =============================================================================

alter table public.suppliers
  add column if not exists address text;
