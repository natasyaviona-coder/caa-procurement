-- =============================================================================
-- CAA Procurement ERP — remember a trip's Google Sheet source
--   Lets a trip be (re)pulled from a link-shared Google Sheet. Run after
--   0008_trips.sql.
-- =============================================================================

alter table public.trips
  add column if not exists source_url text;
