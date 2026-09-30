-- =============================================================
-- POSTY — Chat fixes: LID column, privacy, cleanup
-- =============================================================

-- 1. Add contact_lid column for WhatsApp LID identifiers
alter table public.chat_conversations
  add column if not exists contact_lid text;

-- 2. Clean up invalid conversations (LID stored as phone, no messages)
-- Delete conversations where contact_phone_e164 doesn't start with '+' and has no messages
delete from public.chat_conversations
where contact_phone_e164 !~ '^\+'
  and id not in (select distinct conversation_id from public.chat_messages);

-- 3. Mark remaining LID-keyed conversations: move the LID to contact_lid, clear the phone
update public.chat_conversations
set contact_lid = contact_phone_e164,
    contact_phone_e164 = 'lid:' || contact_phone_e164
where contact_phone_e164 !~ '^\+'
  and contact_phone_e164 != '';

-- 4. Function: apply_personal_account_privacy
-- Hides conversations for personal accounts that don't match known contacts
create or replace function public.apply_personal_account_privacy(p_org_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_conn record;
  v_hidden int := 0;
  v_visible int := 0;
begin
  select * into v_conn from public.whatsapp_connections
  where organization_id = p_org_id and status = 'connected'
  order by created_at desc limit 1;

  if not found or v_conn.account_type != 'personal' then
    return json_build_object('skipped', true, 'reason', 'not_personal');
  end if;

  -- Build set of known phones (guests, contracts, event clients)
  with known_phones as (
    select phone as phone_e164 from public.guests
    where organization_id = p_org_id and phone is not null
    union
    select contact_phone_e164 from public.chat_conversations
    where organization_id = p_org_id
      and guest_id is not null
    union
    select client_phone from public.event_bookings
    where organization_id = p_org_id and client_phone is not null
  )
  -- Hide conversations whose phone doesn't match any known contact
  -- and that have no inbound messages (never wrote to us)
  update public.chat_conversations c
  set is_hidden = true
  where c.organization_id = p_org_id
    and c.connection_id = v_conn.id
    and c.is_hidden = false
    and c.contact_phone_e164 not in (select phone_e164 from known_phones)
    and not exists (
      select 1 from public.chat_messages m
      where m.conversation_id = c.id and m.direction = 'in'
      and m.created_at > v_conn.connected_at
    );

  get diagnostics v_hidden = row_count;

  -- Count visible
  select count(*) into v_visible from public.chat_conversations
  where organization_id = p_org_id and is_hidden = false;

  return json_build_object('hidden', v_hidden, 'visible', v_visible);
end;
$$;

grant execute on function public.apply_personal_account_privacy(uuid) to authenticated;

-- 5. Function: delete_imported_non_guest_chats
create or replace function public.delete_imported_non_guest_chats(p_org_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_deleted_convos int := 0;
  v_deleted_msgs int := 0;
begin
  -- Delete messages of non-guest conversations
  delete from public.chat_messages
  where conversation_id in (
    select id from public.chat_conversations
    where organization_id = p_org_id
      and guest_id is null
      and is_hidden = true
  );
  get diagnostics v_deleted_msgs = row_count;

  -- Delete the conversations
  delete from public.chat_conversations
  where organization_id = p_org_id
    and guest_id is null
    and is_hidden = true;
  get diagnostics v_deleted_convos = row_count;

  return json_build_object('deleted_conversations', v_deleted_convos, 'deleted_messages', v_deleted_msgs);
end;
$$;

grant execute on function public.delete_imported_non_guest_chats(uuid) to authenticated;
