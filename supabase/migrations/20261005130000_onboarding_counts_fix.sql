-- =============================================================
-- POSTY — Fix: add missing counts to get_onboarding_counts
-- Schedules and housekeeping were always returning false
-- because the RPC didn't count their tables.
-- =============================================================

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

  select organization_id into v_org_id
  from public.profiles where id = v_user_id;
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
    -- NEW: schedules and housekeeping
    'work_schedules', (select count(*) from public.work_schedules where organization_id = v_org_id),
    'cleaning_types', (select count(*) from public.cleaning_types where organization_id = v_org_id and archived_at is null)
  ) into v_result;

  return v_result;
end;
$$;
