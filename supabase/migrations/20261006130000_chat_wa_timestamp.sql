-- =============================================================
-- POSTY — Fix: store WhatsApp's actual message timestamp
-- Messages were ordered by created_at (insertion time), not by
-- when they were actually sent in WhatsApp. This caused
-- out-of-order display when messages arrived late.
-- =============================================================

-- 1. Add wa_timestamp column (nullable — outbound messages from POSTY may not have it)
alter table public.chat_messages
  add column if not exists wa_timestamp timestamptz;

-- 2. Backfill: set wa_timestamp = created_at for existing messages
update public.chat_messages set wa_timestamp = created_at where wa_timestamp is null;

-- 3. New index for ordering: wa_timestamp desc with created_at fallback
create index if not exists idx_chat_messages_conv_wa_ts
  on public.chat_messages(conversation_id, wa_timestamp desc nulls last, id desc);

-- 4. Drop old index (superseded)
drop index if exists idx_chat_messages_conversation;
