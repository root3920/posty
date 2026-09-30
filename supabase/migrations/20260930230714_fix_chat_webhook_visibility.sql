-- =============================================================
-- POSTY — Fix: chat webhook, visibility control, name recovery
-- =============================================================

-- -----------------------------------------------
-- 1. Add visibility column to chat_contacts
-- -----------------------------------------------
alter table public.chat_contacts
  add column if not exists visibility text not null default 'auto'
  check (visibility in ('auto', 'visible', 'hidden'));

-- -----------------------------------------------
-- 2. Fix upsert_chat_contact — grant to service_role too
-- -----------------------------------------------
grant execute on function public.upsert_chat_contact(uuid, text, text, text, text) to service_role;
grant execute on function public.upsert_chat_conversation(uuid, uuid, uuid, text, text, boolean) to service_role;

-- -----------------------------------------------
-- 3. Rewrite upsert_chat_conversation to NOT depend on connection_id
-- The conversation belongs to the CONTACT, not the connection.
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
  -- Find existing conversation by contact_id (the canonical key)
  select id into v_conv_id from public.chat_conversations
  where organization_id = p_org_id and contact_id = p_contact_id
  limit 1;

  -- Fallback: find by phone (for conversations created before contact_id existed)
  if v_conv_id is null and p_contact_phone is not null then
    select id into v_conv_id from public.chat_conversations
    where organization_id = p_org_id and contact_phone_e164 = p_contact_phone
    limit 1;
    -- Link to contact
    if v_conv_id is not null then
      update public.chat_conversations
      set contact_id = p_contact_id, connection_id = p_connection_id
      where id = v_conv_id;
    end if;
  end if;

  if v_conv_id is not null then
    if p_contact_name is not null then
      update public.chat_conversations set contact_name = p_contact_name
      where id = v_conv_id and contact_name is null;
    end if;
    -- Always update connection_id to current
    update public.chat_conversations set connection_id = p_connection_id where id = v_conv_id;
    if p_is_inbound then
      update public.chat_conversations set last_inbound_at = now() where id = v_conv_id;
    end if;
    return v_conv_id;
  end if;

  -- Create new — use a simple insert, avoid ON CONFLICT on the old composite key
  begin
    insert into public.chat_conversations (
      organization_id, connection_id, contact_id,
      contact_phone_e164, contact_name, status, is_hidden,
      last_inbound_at
    ) values (
      p_org_id, p_connection_id, p_contact_id,
      coalesce(p_contact_phone, 'contact:' || p_contact_id::text),
      p_contact_name, 'open', false,
      case when p_is_inbound then now() else null end
    )
    returning id into v_conv_id;
  exception when unique_violation then
    -- Race condition: another webhook just created it, re-fetch
    select id into v_conv_id from public.chat_conversations
    where organization_id = p_org_id and contact_id = p_contact_id
    limit 1;
    if v_conv_id is null then
      select id into v_conv_id from public.chat_conversations
      where organization_id = p_org_id and contact_phone_e164 = p_contact_phone
      limit 1;
    end if;
  end;

  return v_conv_id;
end;
$$;

-- -----------------------------------------------
-- 4. Unhide ALL conversations (the migration hid too aggressively)
-- Visibility will be controlled by the user's preference from now on.
-- -----------------------------------------------
update public.chat_conversations set is_hidden = false;

-- -----------------------------------------------
-- 5. Recover whatsapp_name from webhook logs for contacts without names
-- -----------------------------------------------
do $$
declare
  v_log record;
  v_push_name text;
  v_jid text;
  v_phone text;
  v_contact_id uuid;
begin
  for v_log in
    select payload from public.whatsapp_webhook_logs
    where event_type in ('messages.upsert', 'MESSAGES_UPSERT')
      and status in ('processed', 'pending')
    order by created_at desc
    limit 500
  loop
    v_push_name := v_log.payload->'data'->>'pushName';
    v_jid := v_log.payload->'data'->'key'->>'remoteJid';

    if v_push_name is null or v_jid is null then continue; end if;
    -- Skip if fromMe (that's the hotel's name)
    if (v_log.payload->'data'->'key'->>'fromMe')::boolean then continue; end if;

    -- Extract phone
    if v_jid like '%@s.whatsapp.net' then
      v_phone := '+' || regexp_replace(split_part(v_jid, '@', 1), '\D', '', 'g');
    else
      v_phone := null;
    end if;

    -- Update contact name if missing
    if v_phone is not null then
      update public.chat_contacts set whatsapp_name = v_push_name
      where phone_e164 = v_phone and whatsapp_name is null;
      -- Also update conversation name
      update public.chat_conversations set contact_name = v_push_name
      where contact_phone_e164 = v_phone and contact_name is null;
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------
-- 6. Function: set_contact_visibility
-- -----------------------------------------------
create or replace function public.set_contact_visibility(
  p_contact_id uuid,
  p_visibility text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.profiles where id = auth.uid() limit 1;

  update public.chat_contacts set visibility = p_visibility
  where id = p_contact_id and organization_id = v_org_id;

  -- Apply to conversation
  if p_visibility = 'hidden' then
    update public.chat_conversations set is_hidden = true
    where contact_id = p_contact_id and organization_id = v_org_id;
  elsif p_visibility = 'visible' then
    update public.chat_conversations set is_hidden = false
    where contact_id = p_contact_id and organization_id = v_org_id;
  end if;
end;
$$;

grant execute on function public.set_contact_visibility(uuid, text) to authenticated;
