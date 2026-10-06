-- =============================================================
-- POSTY — Final constraint application
-- All previous migrations are marked as applied.
-- This migration catches anything still missing.
-- Every statement is idempotent.
-- =============================================================

-- Clean data
update public.guests set birth_date = null where birth_date > current_date;
update public.rooms set number = '1' where number = '0';
update public.room_types set max_adults = greatest(max_adults, 1) where max_adults < 1;
update public.room_types set max_adults = least(max_adults, 50) where max_adults > 50;
update public.room_types set max_children = greatest(max_children, 0) where max_children < 0;
update public.room_types set max_children = least(max_children, 50) where max_children > 50;
update public.payments set amount = greatest(amount, 0.01) where amount <= 0;

-- Constraints (DROP IF EXISTS → ADD)
alter table public.guests drop constraint if exists chk_guests_birth_date;
alter table public.guests add constraint chk_guests_birth_date check (birth_date is null or birth_date <= current_date);

alter table public.rooms drop constraint if exists chk_rooms_room_number_not_zero;
alter table public.rooms drop constraint if exists chk_rooms_number_not_zero;
alter table public.rooms add constraint chk_rooms_number_not_zero check (number != '0');

alter table public.room_types drop constraint if exists chk_room_types_max_adults;
alter table public.room_types add constraint chk_room_types_max_adults check (max_adults >= 1 and max_adults <= 50);
alter table public.room_types drop constraint if exists chk_room_types_max_children;
alter table public.room_types add constraint chk_room_types_max_children check (max_children >= 0 and max_children <= 50);

alter table public.payments drop constraint if exists chk_payments_reasonable_amount;
alter table public.payments add constraint chk_payments_reasonable_amount check (amount > 0 and amount < 100000000000);

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name = 'tax_amount') then
    execute 'alter table public.expenses drop constraint if exists chk_expenses_tax_not_exceed';
    execute 'alter table public.expenses add constraint chk_expenses_tax_not_exceed check (tax_amount is null or tax_amount >= 0)';
  end if;
end;
$$;

-- Onboarding counts RPC (latest version)
create or replace function public.get_onboarding_counts()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
begin
  if v_user_id is null then return '{}'::jsonb; end if;
  select organization_id into v_org_id from public.profiles where id = v_user_id;
  if v_org_id is null then return '{}'::jsonb; end if;

  return jsonb_build_object(
    'room_types', (select count(*) from public.room_types where organization_id = v_org_id and archived_at is null),
    'rooms', (select count(*) from public.rooms where organization_id = v_org_id and is_active = true),
    'stays', (select count(*) from public.stays where organization_id = v_org_id),
    'team_members', (select count(*) from public.profiles where organization_id = v_org_id and is_active = true),
    'payment_methods', (select count(*) from public.payment_methods where organization_id = v_org_id and archived_at is null),
    'event_venues', (select count(*) from public.event_venues where organization_id = v_org_id and is_active = true),
    'recurring_tasks', (select count(*) from public.recurring_tasks where organization_id = v_org_id and is_active = true),
    'whatsapp_connected', (select count(*) from public.whatsapp_connections where organization_id = v_org_id and status = 'connected'),
    'instagram_connected', (select count(*) from public.instagram_connections where organization_id = v_org_id and status = 'connected'),
    'has_tax_id', (select tax_id is not null and btrim(tax_id) != '' from public.organizations where id = v_org_id),
    'has_rnt', (select rnt_number is not null and btrim(rnt_number) != '' from public.organizations where id = v_org_id),
    'has_logo', (select logo_url is not null and btrim(logo_url) != '' from public.organizations where id = v_org_id),
    'work_schedules', (select count(*) from public.work_schedules where organization_id = v_org_id),
    'cleaning_types', (select count(*) from public.cleaning_types where organization_id = v_org_id and archived_at is null)
  );
end;
$$;

-- Chat: cleared_at + delete permission + RPCs (idempotent)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chat_contacts' and column_name = 'cleared_at') then
    alter table public.chat_contacts add column cleared_at timestamptz;
  end if;
end;
$$;

insert into public.permissions (key, module, action, scope, description) values
  ('chat.delete_conversations', 'chat', 'delete_conversations', null, 'Eliminar conversaciones de chat')
on conflict (key) do nothing;

do $$
declare v_role record;
begin
  for v_role in select id from public.roles where system_key = 'manager' or (is_system = true and name = 'Gestor') loop
    insert into public.role_permissions (role_id, permission_key)
    values (v_role.id, 'chat.delete_conversations')
    on conflict do nothing;
  end loop;
end;
$$;

-- delete_chat_conversation RPC
create or replace function public.delete_chat_conversation(p_conversation_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_conv record;
  v_msg_count int;
  v_note_count int;
  v_contact_deleted boolean := false;
  v_media_paths text[];
begin
  if v_user_id is null then raise exception 'No autenticado'; end if;
  select organization_id into v_org_id from public.profiles where id = v_user_id;
  if v_org_id is null then raise exception 'Sin organización'; end if;
  if not public.has_permission('chat.delete_conversations') then
    raise exception 'No tienes permiso para eliminar conversaciones';
  end if;

  select c.id, c.contact_id, c.contact_name, c.contact_phone_e164, c.guest_id
  into v_conv from public.chat_conversations c
  where c.id = p_conversation_id and c.organization_id = v_org_id;
  if v_conv is null then raise exception 'Conversación no encontrada'; end if;

  select array_agg(media_path) filter (where media_path is not null)
  into v_media_paths from public.chat_messages where conversation_id = p_conversation_id;

  select count(*) into v_msg_count from public.chat_messages where conversation_id = p_conversation_id;
  select count(*) into v_note_count from public.chat_notes where conversation_id = p_conversation_id;

  if v_conv.contact_id is not null then
    update public.chat_contacts set cleared_at = now() where id = v_conv.contact_id;
  end if;

  delete from public.chat_messages where conversation_id = p_conversation_id;
  delete from public.chat_notes where conversation_id = p_conversation_id;
  delete from public.chat_conversations where id = p_conversation_id;

  if v_conv.contact_id is not null and v_conv.guest_id is null then
    if not exists (select 1 from public.chat_conversations where contact_id = v_conv.contact_id) then
      delete from public.chat_contacts where id = v_conv.contact_id;
      v_contact_deleted := true;
    end if;
  end if;

  insert into public.audit_log (organization_id, entity_type, entity_id, action, after, actor_id)
  values (v_org_id, 'chat_conversation', p_conversation_id, 'deleted',
    json_build_object('contact_name', v_conv.contact_name, 'contact_phone', v_conv.contact_phone_e164,
      'messages_deleted', v_msg_count, 'notes_deleted', v_note_count, 'contact_deleted', v_contact_deleted)::jsonb,
    v_user_id);

  return json_build_object('success', true, 'messages_deleted', v_msg_count,
    'notes_deleted', v_note_count, 'contact_deleted', v_contact_deleted,
    'media_paths', coalesce(v_media_paths, array[]::text[]));
end;
$$;

create or replace function public.delete_chat_conversations_bulk(p_conversation_ids uuid[])
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid; v_total_messages int := 0; v_total_contacts int := 0; v_count int := 0; v_result json;
begin
  if array_length(p_conversation_ids, 1) > 50 then raise exception 'Máximo 50 conversaciones por lote'; end if;
  foreach v_id in array p_conversation_ids loop
    v_result := public.delete_chat_conversation(v_id);
    v_total_messages := v_total_messages + (v_result->>'messages_deleted')::int;
    if (v_result->>'contact_deleted')::boolean then v_total_contacts := v_total_contacts + 1; end if;
    v_count := v_count + 1;
  end loop;
  return json_build_object('success', true, 'conversations_deleted', v_count,
    'total_messages_deleted', v_total_messages, 'contacts_deleted', v_total_contacts);
end;
$$;

-- Onboarding state table (if not exists)
create table if not exists public.onboarding_state (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null default 'true',
  created_at timestamptz not null default now(),
  constraint uq_onboarding_state unique (organization_id, user_id, key)
);

do $$
begin
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'onboarding_state' and rowsecurity = true) then
    alter table public.onboarding_state enable row level security;
  end if;
exception when others then null;
end;
$$;

-- Policies (idempotent via DO block)
do $$
begin
  begin
    create policy "Users can view own onboarding state" on public.onboarding_state for select
      using (organization_id = public.current_org_id() and user_id = auth.uid());
  exception when duplicate_object then null;
  end;
  begin
    create policy "Users can manage own onboarding state" on public.onboarding_state for all
      using (organization_id = public.current_org_id() and user_id = auth.uid());
  exception when duplicate_object then null;
  end;
end;
$$;

-- Onboarding state RPCs
create or replace function public.get_onboarding_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_org_id uuid;
begin
  if v_user_id is null then return '{}'::jsonb; end if;
  select organization_id into v_org_id from public.profiles where id = v_user_id;
  if v_org_id is null then return '{}'::jsonb; end if;
  return coalesce((select jsonb_object_agg(key, value) from public.onboarding_state
    where organization_id = v_org_id and user_id = v_user_id), '{}'::jsonb);
end; $$;

create or replace function public.set_onboarding_state(p_key text, p_value text default 'true')
returns void language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_org_id uuid;
begin
  if v_user_id is null then raise exception 'No autenticado'; end if;
  select organization_id into v_org_id from public.profiles where id = v_user_id;
  if v_org_id is null then raise exception 'Sin organización'; end if;
  insert into public.onboarding_state (organization_id, user_id, key, value)
  values (v_org_id, v_user_id, p_key, p_value)
  on conflict (organization_id, user_id, key) do update set value = p_value;
end; $$;
