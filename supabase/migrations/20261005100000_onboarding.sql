-- =============================================================
-- POSTY — Onboarding state table
-- Stores per-user, per-org state that cannot be derived from data:
-- wizard_seen, step_skipped:<id>, tour_seen:<module>, panel_minimized
-- =============================================================

create table public.onboarding_state (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null default 'true',
  created_at timestamptz not null default now(),

  constraint uq_onboarding_state unique (organization_id, user_id, key)
);

create index idx_onboarding_state_org_user
  on public.onboarding_state(organization_id, user_id);

alter table public.onboarding_state enable row level security;

-- Users can only read/write their own org's state
create policy "Users can view own onboarding state"
  on public.onboarding_state for select
  using (organization_id = public.current_org_id() and user_id = auth.uid());

create policy "Users can manage own onboarding state"
  on public.onboarding_state for all
  using (organization_id = public.current_org_id() and user_id = auth.uid());

-- -----------------------------------------------
-- RPC: get all onboarding state for current user
-- -----------------------------------------------
create or replace function public.get_onboarding_state()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_result jsonb := '{}'::jsonb;
begin
  if v_user_id is null then return '{}'::jsonb; end if;

  select organization_id into v_org_id
  from public.profiles where id = v_user_id;
  if v_org_id is null then return '{}'::jsonb; end if;

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  into v_result
  from public.onboarding_state
  where organization_id = v_org_id and user_id = v_user_id;

  return v_result;
end;
$$;

-- -----------------------------------------------
-- RPC: set a single onboarding state key
-- -----------------------------------------------
create or replace function public.set_onboarding_state(p_key text, p_value text default 'true')
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
begin
  if v_user_id is null then raise exception 'No autenticado'; end if;

  select organization_id into v_org_id
  from public.profiles where id = v_user_id;
  if v_org_id is null then raise exception 'Sin organización'; end if;

  insert into public.onboarding_state (organization_id, user_id, key, value)
  values (v_org_id, v_user_id, p_key, p_value)
  on conflict (organization_id, user_id, key)
  do update set value = p_value;
end;
$$;

-- -----------------------------------------------
-- RPC: get onboarding completion counts
-- Returns counts needed to calculate step completion.
-- Single query instead of N separate queries from the client.
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
    'has_logo', (select logo_url is not null and btrim(logo_url) != '' from public.organizations where id = v_org_id)
  ) into v_result;

  return v_result;
end;
$$;
