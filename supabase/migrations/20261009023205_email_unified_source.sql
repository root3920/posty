-- =============================================================
-- POSTY — Unified email sending: add source column
-- =============================================================

-- 1. Add source column to email_messages
alter table public.email_messages
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'guest_profile', 'automation', 'contract', 'reservation', 'event', 'test'));

-- 2. Index for filtering by source
create index if not exists idx_email_messages_source
  on public.email_messages(source);

-- 3. Backfill existing test emails (template = 'test')
update public.email_messages
  set source = 'test'
  where template = 'test' and source = 'manual';
