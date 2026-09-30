-- =============================================================
-- POSTY — Chat Phase 1: notes, quick replies, realtime support
-- =============================================================

-- -----------------------------------------------
-- 1. Table: chat_notes (internal team notes on conversations)
-- -----------------------------------------------
create table public.chat_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_chat_notes_conversation on public.chat_notes(conversation_id, created_at);

alter table public.chat_notes enable row level security;

create policy "Users can view chat_notes of own org"
  on public.chat_notes for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage chat_notes"
  on public.chat_notes for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 2. Table: chat_quick_replies
-- -----------------------------------------------
create table public.chat_quick_replies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  body text not null,
  shortcut text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_chat_quick_replies_org on public.chat_quick_replies(organization_id);

create trigger on_chat_quick_replies_updated
  before update on public.chat_quick_replies
  for each row execute function public.handle_updated_at();

alter table public.chat_quick_replies enable row level security;

create policy "Users can view chat_quick_replies of own org"
  on public.chat_quick_replies for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage chat_quick_replies"
  on public.chat_quick_replies for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 3. Add last_inbound_at to conversations (for 24h window check)
-- -----------------------------------------------
alter table public.chat_conversations
  add column if not exists last_inbound_at timestamptz;

-- -----------------------------------------------
-- 4. Enable Realtime on chat tables
-- -----------------------------------------------
alter publication supabase_realtime add table public.chat_conversations;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_notes;

-- -----------------------------------------------
-- 5. Function: mark_conversation_read
-- -----------------------------------------------
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_conversations
  set unread_count = 0
  where id = p_conversation_id
    and organization_id = (select organization_id from public.profiles where id = auth.uid() limit 1);
end;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- -----------------------------------------------
-- 6. Function: assign_conversation
-- -----------------------------------------------
create or replace function public.assign_conversation(
  p_conversation_id uuid,
  p_profile_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_conversations
  set assigned_to = p_profile_id
  where id = p_conversation_id
    and organization_id = (select organization_id from public.profiles where id = auth.uid() limit 1);
end;
$$;

grant execute on function public.assign_conversation(uuid, uuid) to authenticated;

-- -----------------------------------------------
-- 7. Function: close/reopen conversation
-- -----------------------------------------------
create or replace function public.set_conversation_status(
  p_conversation_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_conversations
  set status = p_status::chat_conversation_status
  where id = p_conversation_id
    and organization_id = (select organization_id from public.profiles where id = auth.uid() limit 1);
end;
$$;

grant execute on function public.set_conversation_status(uuid, text) to authenticated;

-- -----------------------------------------------
-- 8. Function: get_chat_unread_count (for sidebar badge)
-- -----------------------------------------------
create or replace function public.get_chat_unread_count()
returns int
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(sum(unread_count), 0)::int
  from public.chat_conversations
  where organization_id = (select organization_id from public.profiles where id = auth.uid() limit 1)
    and is_hidden = false
    and status != 'closed'::chat_conversation_status;
$$;

grant execute on function public.get_chat_unread_count() to authenticated;
