-- =============================================================
-- POSTY — Hotel E3: Merge guests, change titular, history
-- =============================================================

-- -----------------------------------------------
-- 1. Function: merge_guests
-- -----------------------------------------------
create or replace function public.merge_guests(
  p_keep_id uuid,
  p_merge_id uuid,
  p_reason text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_keep record;
  v_merge record;
  v_stays_moved int := 0;
  v_contracts_moved int := 0;
  v_chats_moved int := 0;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select * into v_keep from public.guests where id = p_keep_id and organization_id = v_org_id;
  if not found then raise exception 'Huésped principal no encontrado'; end if;

  select * into v_merge from public.guests where id = p_merge_id and organization_id = v_org_id;
  if not found then raise exception 'Huésped a fusionar no encontrado'; end if;

  if p_keep_id = p_merge_id then
    raise exception 'No se puede fusionar un huésped consigo mismo';
  end if;

  -- Move stays
  update public.stays set primary_guest_id = p_keep_id where primary_guest_id = p_merge_id and organization_id = v_org_id;
  get diagnostics v_stays_moved = row_count;

  -- Move stay_guests
  update public.stay_guests set guest_id = p_keep_id
  where guest_id = p_merge_id
    and stay_id in (select id from public.stays where organization_id = v_org_id);

  -- Move contracts
  update public.contracts set guest_id = p_keep_id where guest_id = p_merge_id and organization_id = v_org_id;
  get diagnostics v_contracts_moved = row_count;

  -- Move chat conversations
  update public.chat_conversations set guest_id = p_keep_id where guest_id = p_merge_id and organization_id = v_org_id;
  get diagnostics v_chats_moved = row_count;

  -- Archive the duplicate (soft delete)
  update public.guests set archived_at = now() where id = p_merge_id;

  -- Record in audit_log
  insert into public.audit_log (organization_id, entity_type, entity_id, action, before, after, actor_id, reason)
  values (
    v_org_id, 'guest', p_keep_id, 'merge_guest',
    jsonb_build_object('merged_guest_id', p_merge_id, 'merged_name', v_merge.first_name || ' ' || v_merge.last_name),
    jsonb_build_object('stays_moved', v_stays_moved, 'contracts_moved', v_contracts_moved, 'chats_moved', v_chats_moved),
    v_user_id, p_reason
  );

  return json_build_object(
    'success', true,
    'stays_moved', v_stays_moved,
    'contracts_moved', v_contracts_moved,
    'chats_moved', v_chats_moved,
    'merged_name', v_merge.first_name || ' ' || v_merge.last_name
  );
end;
$$;

grant execute on function public.merge_guests(uuid, uuid, text) to authenticated;

-- -----------------------------------------------
-- 2. Function: change_stay_titular
-- -----------------------------------------------
create or replace function public.change_stay_titular(
  p_stay_id uuid,
  p_new_guest_id uuid,
  p_reason text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_stay record;
  v_old_guest record;
  v_new_guest record;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select * into v_stay from public.stays where id = p_stay_id and organization_id = v_org_id;
  if not found then raise exception 'Estancia no encontrada'; end if;

  select * into v_old_guest from public.guests where id = v_stay.primary_guest_id;
  select * into v_new_guest from public.guests where id = p_new_guest_id and organization_id = v_org_id;
  if not found then raise exception 'Nuevo huésped no encontrado'; end if;

  update public.stays set primary_guest_id = p_new_guest_id where id = p_stay_id;

  -- Record in audit_log
  insert into public.audit_log (organization_id, entity_type, entity_id, action, before, after, actor_id, reason)
  values (
    v_org_id, 'stay', p_stay_id, 'change_titular',
    jsonb_build_object('guest_id', v_stay.primary_guest_id, 'guest_name', v_old_guest.first_name || ' ' || v_old_guest.last_name),
    jsonb_build_object('guest_id', p_new_guest_id, 'guest_name', v_new_guest.first_name || ' ' || v_new_guest.last_name),
    v_user_id, p_reason
  );

  return json_build_object('success', true);
end;
$$;

grant execute on function public.change_stay_titular(uuid, uuid, text) to authenticated;

-- -----------------------------------------------
-- 3. Function: find_duplicate_guests
-- -----------------------------------------------
create or replace function public.find_duplicate_guests()
returns table (
  guest_a_id uuid,
  guest_a_name text,
  guest_b_id uuid,
  guest_b_name text,
  match_type text
)
language sql security definer stable set search_path = public
as $$
  with org as (
    select organization_id from public.profiles where id = auth.uid() limit 1
  )
  -- Match by document
  select
    a.id, a.first_name || ' ' || a.last_name,
    b.id, b.first_name || ' ' || b.last_name,
    'document'
  from public.guests a
  join public.guests b on a.document_number = b.document_number
    and a.document_type_id = b.document_type_id
    and a.organization_id = b.organization_id
    and a.id < b.id
  cross join org
  where a.organization_id = org.organization_id
    and a.archived_at is null and b.archived_at is null
    and a.document_number is not null

  union all

  -- Match by phone
  select
    a.id, a.first_name || ' ' || a.last_name,
    b.id, b.first_name || ' ' || b.last_name,
    'phone'
  from public.guests a
  join public.guests b on a.phone = b.phone
    and a.organization_id = b.organization_id
    and a.id < b.id
  cross join org
  where a.organization_id = org.organization_id
    and a.archived_at is null and b.archived_at is null
    and a.phone is not null

  union all

  -- Match by email
  select
    a.id, a.first_name || ' ' || a.last_name,
    b.id, b.first_name || ' ' || b.last_name,
    'email'
  from public.guests a
  join public.guests b on lower(a.email) = lower(b.email)
    and a.organization_id = b.organization_id
    and a.id < b.id
  cross join org
  where a.organization_id = org.organization_id
    and a.archived_at is null and b.archived_at is null
    and a.email is not null;
$$;

grant execute on function public.find_duplicate_guests() to authenticated;

-- -----------------------------------------------
-- 4. Function: get_guest_stats
-- -----------------------------------------------
create or replace function public.get_guest_stats(p_guest_id uuid)
returns json
language sql security definer stable set search_path = public
as $$
  select json_build_object(
    'total_stays', (
      select count(*) from public.stays
      where primary_guest_id = p_guest_id
        and organization_id = (select organization_id from public.profiles where id = auth.uid() limit 1)
    ),
    'total_nights', (
      select coalesce(sum(nights), 0) from public.stays
      where primary_guest_id = p_guest_id
        and status in ('checked_in', 'checked_out')
        and organization_id = (select organization_id from public.profiles where id = auth.uid() limit 1)
    ),
    'total_spent', (
      select coalesce(sum(fc.total), 0)
      from public.folio_charges fc
      join public.stays s on s.id = fc.stay_id
      where s.primary_guest_id = p_guest_id
        and s.organization_id = (select organization_id from public.profiles where id = auth.uid() limit 1)
    ),
    'total_contracts', (
      select count(*) from public.contracts
      where guest_id = p_guest_id
        and organization_id = (select organization_id from public.profiles where id = auth.uid() limit 1)
    )
  );
$$;

grant execute on function public.get_guest_stats(uuid) to authenticated;
