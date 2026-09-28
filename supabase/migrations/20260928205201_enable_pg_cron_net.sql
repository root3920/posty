-- =============================================================
-- POSTY — Enable pg_cron and pg_net extensions
-- pg_cron: schedule recurring SQL jobs inside the database
-- pg_net: make HTTP requests from SQL (for calling Next.js API)
-- =============================================================

create extension if not exists pg_cron schema pg_catalog;
create extension if not exists pg_net schema extensions;

-- Grant the service role access to cron schema
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- -----------------------------------------------
-- Register cron jobs for implemented features
-- -----------------------------------------------

-- 1. Housekeeping: backfill/schedule cleanings for new stays
--    Runs every 5 minutes to catch any stays that triggers missed
select cron.schedule(
  'housekeeping-backfill',
  '*/5 * * * *',
  $$SELECT public.backfill_housekeeping_cleanings()$$
);

-- 2. Automation queue processor (placeholder for future automation engine)
--    Will process automation_events outbox table
--    For now: no-op, registered so it shows in the config page
-- select cron.schedule(
--   'automation-queue',
--   '* * * * *',
--   $$SELECT 1$$ -- placeholder
-- );
