-- =============================================================
-- POSTY — Apply all pending constraints
-- Previous migrations were marked as applied via repair but their
-- SQL didn't execute. This migration ensures everything is in place.
-- All statements are idempotent (DROP IF EXISTS before ADD).
-- =============================================================

-- -----------------------------------------------
-- 1. Clean data that violates constraints
-- -----------------------------------------------
update public.guests set birth_date = null where birth_date > current_date;
update public.rooms set number = '1' where number = '0';
update public.room_types set max_adults = greatest(max_adults, 1) where max_adults < 1;
update public.room_types set max_adults = 50 where max_adults > 50;
update public.room_types set max_children = greatest(max_children, 0) where max_children < 0;
update public.room_types set max_children = 50 where max_children > 50;
update public.payments set amount = greatest(amount, 0.01) where amount <= 0;
update public.folio_charges set total = greatest(total, 0) where total < 0;

-- -----------------------------------------------
-- 2. Phase 3 constraints (may or may not exist)
-- -----------------------------------------------
alter table public.guests drop constraint if exists chk_guests_birth_date;
alter table public.guests add constraint chk_guests_birth_date check (birth_date is null or birth_date <= current_date);

alter table public.rooms drop constraint if exists chk_rooms_room_number_not_zero;
alter table public.rooms drop constraint if exists chk_rooms_number_not_zero;
alter table public.rooms add constraint chk_rooms_number_not_zero check (number != '0');

alter table public.room_types drop constraint if exists chk_room_types_max_adults;
alter table public.room_types add constraint chk_room_types_max_adults check (max_adults >= 1 and max_adults <= 50);

alter table public.room_types drop constraint if exists chk_room_types_max_children;
alter table public.room_types add constraint chk_room_types_max_children check (max_children >= 0 and max_children <= 50);

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name = 'tax_amount') then
    execute 'alter table public.expenses drop constraint if exists chk_expenses_tax_not_exceed';
    execute 'alter table public.expenses add constraint chk_expenses_tax_not_exceed check (tax_amount is null or tax_amount >= 0)';
  end if;
end;
$$;

alter table public.payments drop constraint if exists chk_payments_reasonable_amount;
alter table public.payments add constraint chk_payments_reasonable_amount check (amount > 0 and amount < 100000000000);

alter table public.folio_charges drop constraint if exists chk_folio_charges_reasonable_total;
alter table public.folio_charges add constraint chk_folio_charges_reasonable_total check (total >= 0 and total < 100000000000);

-- -----------------------------------------------
-- 3. Onboarding RPCs (may already exist)
-- -----------------------------------------------
create or replace function public.get_onboarding_counts()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then return '{}'::jsonb; end if;
  select organization_id into v_org_id from public.profiles where id = v_user_id;
  if v_org_id is null then return '{}'::jsonb; end if;

  select jsonb_build_object(
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
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------
-- 4. Chat delete permission + cleared_at (if not yet)
-- -----------------------------------------------
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
