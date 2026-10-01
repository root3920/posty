-- =============================================================
-- POSTY — Fix: store remote_jid for sending to LID contacts
-- =============================================================

-- 1. Add remote_jid to chat_contacts (the exact JID Evolution uses)
alter table public.chat_contacts
  add column if not exists remote_jid text;

-- 2. Populate remote_jid from existing data
update public.chat_contacts set remote_jid = phone_e164 || '@s.whatsapp.net'
where phone_e164 is not null and phone_e164 like '+%' and remote_jid is null;

update public.chat_contacts set remote_jid = lid || '@lid'
where lid is not null and remote_jid is null;

-- 3. Update upsert_chat_contact to accept and store remote_jid
create or replace function public.upsert_chat_contact(
  p_org_id uuid,
  p_phone text default null,
  p_lid text default null,
  p_whatsapp_name text default null,
  p_profile_pic text default null,
  p_remote_jid text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_contact_id uuid;
begin
  -- Find by phone first, then by LID
  if p_phone is not null and p_phone != '' and p_phone not like 'lid:%' then
    select id into v_contact_id from public.chat_contacts
    where organization_id = p_org_id and phone_e164 = p_phone;
  end if;

  if v_contact_id is null and p_lid is not null then
    select id into v_contact_id from public.chat_contacts
    where organization_id = p_org_id and lid = p_lid;
  end if;

  if v_contact_id is not null then
    update public.chat_contacts set
      phone_e164 = coalesce(
        case when p_phone is not null and p_phone != '' and p_phone not like 'lid:%' then p_phone else null end,
        phone_e164
      ),
      lid = coalesce(p_lid, lid),
      whatsapp_name = coalesce(p_whatsapp_name, whatsapp_name),
      profile_pic_url = coalesce(p_profile_pic, profile_pic_url),
      remote_jid = coalesce(p_remote_jid, remote_jid)
    where id = v_contact_id;
    return v_contact_id;
  end if;

  insert into public.chat_contacts (organization_id, phone_e164, lid, whatsapp_name, profile_pic_url, remote_jid)
  values (
    p_org_id,
    case when p_phone is not null and p_phone != '' and p_phone not like 'lid:%' then p_phone else null end,
    p_lid,
    p_whatsapp_name,
    p_profile_pic,
    p_remote_jid
  )
  on conflict do nothing
  returning id into v_contact_id;

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

grant execute on function public.upsert_chat_contact(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.upsert_chat_contact(uuid, text, text, text, text, text) to service_role;

-- 4. Update last_message_preview in upsert_chat_conversation
-- (fix "Sin mensajes" issue — preview must be set when conversation is updated)
