-- =============================================================
-- POSTY — Chat: contacts table, deduplication, privacy cleanup
-- =============================================================

-- -----------------------------------------------
-- 1. Table: chat_contacts
-- -----------------------------------------------
create table public.chat_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone_e164 text,
  lid text,
  whatsapp_name text,
  custom_name text,
  guest_id uuid references public.guests(id) on delete set null,
  profile_pic_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Partial unique indexes: one phone per org, one LID per org
create unique index idx_chat_contacts_phone on public.chat_contacts(organization_id, phone_e164)
  where phone_e164 is not null;
create unique index idx_chat_contacts_lid on public.chat_contacts(organization_id, lid)
  where lid is not null;
create index idx_chat_contacts_guest on public.chat_contacts(guest_id);

create trigger on_chat_contacts_updated
  before update on public.chat_contacts
  for each row execute function public.handle_updated_at();

alter table public.chat_contacts enable row level security;
create policy "View contacts of own org" on public.chat_contacts for select using (organization_id = public.current_org_id());
create policy "Manage contacts" on public.chat_contacts for all using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 2. Add contact_id to chat_conversations
-- -----------------------------------------------
alter table public.chat_conversations
  add column if not exists contact_id uuid references public.chat_contacts(id) on delete set null;

create index idx_chat_conversations_contact on public.chat_conversations(contact_id);

-- -----------------------------------------------
-- 3. Function: upsert_chat_contact (atomic, no race condition)
-- -----------------------------------------------
create or replace function public.upsert_chat_contact(
  p_org_id uuid,
  p_phone text default null,
  p_lid text default null,
  p_whatsapp_name text default null,
  p_profile_pic text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_contact_id uuid;
begin
  -- Try to find by phone first, then by LID
  if p_phone is not null and p_phone != '' and p_phone not like 'lid:%' then
    select id into v_contact_id from public.chat_contacts
    where organization_id = p_org_id and phone_e164 = p_phone;
  end if;

  if v_contact_id is null and p_lid is not null then
    select id into v_contact_id from public.chat_contacts
    where organization_id = p_org_id and lid = p_lid;
  end if;

  if v_contact_id is not null then
    -- Update existing contact with new data
    update public.chat_contacts set
      phone_e164 = coalesce(
        case when p_phone is not null and p_phone != '' and p_phone not like 'lid:%' then p_phone else null end,
        phone_e164
      ),
      lid = coalesce(p_lid, lid),
      whatsapp_name = coalesce(p_whatsapp_name, whatsapp_name),
      profile_pic_url = coalesce(p_profile_pic, profile_pic_url)
    where id = v_contact_id;
    return v_contact_id;
  end if;

  -- Create new contact
  insert into public.chat_contacts (organization_id, phone_e164, lid, whatsapp_name, profile_pic_url)
  values (
    p_org_id,
    case when p_phone is not null and p_phone != '' and p_phone not like 'lid:%' then p_phone else null end,
    p_lid,
    p_whatsapp_name,
    p_profile_pic
  )
  on conflict do nothing
  returning id into v_contact_id;

  -- If insert conflicted (race condition), re-fetch
  if v_contact_id is null then
    if p_phone is not null and p_phone != '' and p_phone not like 'lid:%' then
      select id into v_contact_id from public.chat_contacts
      where organization_id = p_org_id and phone_e164 = p_phone;
    end if;
    if v_contact_id is null and p_lid is not null then
      select id into v_contact_id from public.chat_contacts
      where organization_id = p_org_id and lid = p_lid;
    end if;
  end if;

  -- Auto-link to guest by phone
  if v_contact_id is not null and p_phone is not null and p_phone not like 'lid:%' then
    update public.chat_contacts set guest_id = g.id
    from public.guests g
    where chat_contacts.id = v_contact_id
      and g.organization_id = p_org_id
      and g.phone = p_phone
      and chat_contacts.guest_id is null;
  end if;

  return v_contact_id;
end;
$$;

grant execute on function public.upsert_chat_contact(uuid, text, text, text, text) to authenticated;

-- -----------------------------------------------
-- 4. Function: upsert_chat_conversation (atomic)
-- -----------------------------------------------
create or replace function public.upsert_chat_conversation(
  p_org_id uuid,
  p_connection_id uuid,
  p_contact_id uuid,
  p_contact_phone text default null,
  p_contact_name text default null,
  p_is_inbound boolean default false
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_conv_id uuid;
begin
  -- Find existing conversation by contact_id (preferred) or phone
  select id into v_conv_id from public.chat_conversations
  where organization_id = p_org_id and contact_id = p_contact_id
  limit 1;

  if v_conv_id is null and p_contact_phone is not null then
    select id into v_conv_id from public.chat_conversations
    where organization_id = p_org_id and contact_phone_e164 = p_contact_phone
    limit 1;

    -- Link existing conversation to the contact
    if v_conv_id is not null then
      update public.chat_conversations set contact_id = p_contact_id where id = v_conv_id;
    end if;
  end if;

  if v_conv_id is not null then
    -- Update name if provided
    if p_contact_name is not null then
      update public.chat_conversations set contact_name = p_contact_name
      where id = v_conv_id and contact_name is null;
    end if;
    if p_is_inbound then
      update public.chat_conversations set last_inbound_at = now() where id = v_conv_id;
    end if;
    return v_conv_id;
  end if;

  -- Create new conversation
  insert into public.chat_conversations (
    organization_id, connection_id, contact_id,
    contact_phone_e164, contact_name, status, is_hidden
  ) values (
    p_org_id, p_connection_id, p_contact_id,
    coalesce(p_contact_phone, 'contact:' || p_contact_id::text),
    p_contact_name, 'open', false
  )
  on conflict (organization_id, connection_id, contact_phone_e164) do update
    set contact_id = excluded.contact_id,
        contact_name = coalesce(excluded.contact_name, chat_conversations.contact_name)
  returning id into v_conv_id;

  return v_conv_id;
end;
$$;

grant execute on function public.upsert_chat_conversation(uuid, uuid, uuid, text, text, boolean) to authenticated;

-- -----------------------------------------------
-- 5. Migration: populate chat_contacts from existing conversations
-- -----------------------------------------------
do $$
declare
  v_conv record;
  v_contact_id uuid;
  v_phone text;
  v_lid text;
begin
  for v_conv in
    select id, organization_id, contact_phone_e164, contact_lid, contact_name, contact_pic_url, guest_id
    from public.chat_conversations
    where contact_id is null
    order by last_message_at desc nulls last
  loop
    -- Extract phone and LID
    v_phone := null;
    v_lid := v_conv.contact_lid;
    if v_conv.contact_phone_e164 is not null and v_conv.contact_phone_e164 like '+%' then
      v_phone := v_conv.contact_phone_e164;
    elsif v_conv.contact_phone_e164 like 'lid:%' then
      v_lid := replace(v_conv.contact_phone_e164, 'lid:', '');
    end if;

    -- Upsert contact
    v_contact_id := public.upsert_chat_contact(
      v_conv.organization_id,
      v_phone,
      v_lid,
      v_conv.contact_name,
      v_conv.contact_pic_url
    );

    if v_contact_id is not null then
      -- Link guest if conversation had one
      if v_conv.guest_id is not null then
        update public.chat_contacts set guest_id = v_conv.guest_id
        where id = v_contact_id and guest_id is null;
      end if;
      -- Link conversation to contact
      update public.chat_conversations set contact_id = v_contact_id where id = v_conv.id;
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------
-- 6. Deduplicate conversations: merge by contact_id
-- -----------------------------------------------
do $$
declare
  v_dup record;
  v_keep_id uuid;
begin
  -- Find contacts with multiple conversations
  for v_dup in
    select contact_id, organization_id, count(*) as cnt
    from public.chat_conversations
    where contact_id is not null
    group by contact_id, organization_id
    having count(*) > 1
  loop
    -- Keep the oldest conversation (most history)
    select id into v_keep_id from public.chat_conversations
    where contact_id = v_dup.contact_id and organization_id = v_dup.organization_id
    order by created_at asc
    limit 1;

    -- Move messages from duplicates to the keeper
    update public.chat_messages set conversation_id = v_keep_id
    where conversation_id in (
      select id from public.chat_conversations
      where contact_id = v_dup.contact_id
        and organization_id = v_dup.organization_id
        and id != v_keep_id
    );

    -- Move notes
    update public.chat_notes set conversation_id = v_keep_id
    where conversation_id in (
      select id from public.chat_conversations
      where contact_id = v_dup.contact_id
        and organization_id = v_dup.organization_id
        and id != v_keep_id
    );

    -- Delete the duplicate conversations
    delete from public.chat_conversations
    where contact_id = v_dup.contact_id
      and organization_id = v_dup.organization_id
      and id != v_keep_id;

    -- Recalculate last message and unread count
    update public.chat_conversations set
      last_message_at = (select max(created_at) from public.chat_messages where conversation_id = v_keep_id),
      last_message_preview = (
        select body from public.chat_messages
        where conversation_id = v_keep_id
        order by created_at desc limit 1
      ),
      unread_count = (
        select count(*) from public.chat_messages
        where conversation_id = v_keep_id and direction = 'in' and status != 'read'
      )
    where id = v_keep_id;
  end loop;
end;
$$;

-- -----------------------------------------------
-- 7. Delete conversations with no messages
-- -----------------------------------------------
delete from public.chat_conversations
where id not in (select distinct conversation_id from public.chat_messages)
  and id not in (select distinct conversation_id from public.chat_notes);

-- -----------------------------------------------
-- 8. Apply privacy: hide personal account chats
-- -----------------------------------------------
do $$
declare
  v_conn record;
begin
  for v_conn in
    select id, organization_id, account_type, connected_at
    from public.whatsapp_connections
    where account_type = 'personal'
  loop
    -- Hide conversations that don't match known contacts
    update public.chat_conversations c
    set is_hidden = true
    where c.organization_id = v_conn.organization_id
      and c.is_hidden = false
      and c.contact_id is not null
      and not exists (
        -- Has a linked guest
        select 1 from public.chat_contacts cc
        where cc.id = c.contact_id and cc.guest_id is not null
      )
      and not exists (
        -- Phone matches an event booking client
        select 1 from public.chat_contacts cc
        join public.event_bookings eb on eb.client_phone = cc.phone_e164
        where cc.id = c.contact_id and eb.organization_id = v_conn.organization_id
      )
      and not exists (
        -- Has inbound messages after connection
        select 1 from public.chat_messages m
        where m.conversation_id = c.id and m.direction = 'in'
        and m.created_at > coalesce(v_conn.connected_at, '2000-01-01')
      );
  end loop;
end;
$$;

-- -----------------------------------------------
-- 9. Add unique constraint: one conversation per contact per org
-- -----------------------------------------------
create unique index if not exists idx_chat_conversations_contact_unique
  on public.chat_conversations(organization_id, contact_id)
  where contact_id is not null;

-- -----------------------------------------------
-- 10. Function: rename_chat_contact
-- -----------------------------------------------
create or replace function public.rename_chat_contact(
  p_contact_id uuid,
  p_custom_name text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.profiles where id = auth.uid() limit 1;

  update public.chat_contacts set custom_name = p_custom_name
  where id = p_contact_id and organization_id = v_org_id;

  -- Also update conversation name
  update public.chat_conversations set contact_name = p_custom_name
  where contact_id = p_contact_id and organization_id = v_org_id;

  -- Audit log
  insert into public.audit_log (organization_id, entity_type, entity_id, action, after, actor_id)
  values (v_org_id, 'chat_contact', p_contact_id, 'rename',
    jsonb_build_object('custom_name', p_custom_name), auth.uid());
end;
$$;

grant execute on function public.rename_chat_contact(uuid, text) to authenticated;

-- Enable realtime on chat_contacts
alter publication supabase_realtime add table public.chat_contacts;
