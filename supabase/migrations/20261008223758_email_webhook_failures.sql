-- =============================================================
-- POSTY — Email webhook failure tracking + case-insensitive tokens
--
-- 1. Extend email_webhook_events with status, error, step, raw_payload
-- 2. Make email_threads.token lookups case-insensitive
-- =============================================================

-- -----------------------------------------------
-- 1. Extend email_webhook_events for failure tracking
-- -----------------------------------------------
alter table public.email_webhook_events
  add column if not exists status text not null default 'processed'
    check (status in ('processed', 'failed', 'skipped')),
  add column if not exists error text,
  add column if not exists failed_step text,
  add column if not exists raw_payload jsonb;

create index if not exists idx_email_webhook_events_failed
  on public.email_webhook_events(status) where status = 'failed';

-- -----------------------------------------------
-- 2. Case-insensitive token index
--    Tokens are generated as mixed-case nanoid but email systems
--    may lowercase the +token part in the address.
-- -----------------------------------------------
create index if not exists idx_email_threads_token_lower
  on public.email_threads(lower(token));
