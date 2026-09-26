-- =============================================================
-- POSTY — Migration: has_permission() function
-- =============================================================

-- Security definer function: checks if current user has a specific permission
-- Used in RLS policies, proxy/middleware, and usePermissions() hook
create or replace function public.has_permission(p_key text)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_role_id uuid;
begin
  -- Get the role of the current user
  select role_id into v_role_id
  from public.profiles
  where id = auth.uid()
  limit 1;

  if v_role_id is null then
    return false;
  end if;

  -- Check if the role has the permission
  return exists (
    select 1 from public.role_permissions
    where role_id = v_role_id
      and permission_key = p_key
  );
end;
$$;

-- Helper: get all permissions for current user
create or replace function public.get_my_permissions()
returns text[]
language plpgsql
security definer
stable
as $$
declare
  v_role_id uuid;
  v_permissions text[];
begin
  select role_id into v_role_id
  from public.profiles
  where id = auth.uid()
  limit 1;

  if v_role_id is null then
    return array[]::text[];
  end if;

  select array_agg(permission_key) into v_permissions
  from public.role_permissions
  where role_id = v_role_id;

  return coalesce(v_permissions, array[]::text[]);
end;
$$;

-- Helper: get current user's profile with org info
create or replace function public.get_my_profile()
returns json
language plpgsql
security definer
stable
as $$
declare
  v_result json;
begin
  select json_build_object(
    'id', p.id,
    'organization_id', p.organization_id,
    'role_id', p.role_id,
    'full_name', p.full_name,
    'email', p.email,
    'phone', p.phone,
    'avatar_url', p.avatar_url,
    'job_title', p.job_title,
    'is_active', p.is_active,
    'availability_override', p.availability_override,
    'availability_note', p.availability_note,
    'role', json_build_object(
      'id', r.id,
      'name', r.name,
      'color', r.color,
      'home_route', r.home_route
    ),
    'organization', json_build_object(
      'id', o.id,
      'name', o.name,
      'logo_url', o.logo_url,
      'brand_color', o.brand_color,
      'currency', o.currency,
      'locale', o.locale,
      'timezone', o.timezone,
      'date_format', o.date_format,
      'tax_rate', o.tax_rate,
      'default_check_in_time', o.default_check_in_time,
      'default_check_out_time', o.default_check_out_time
    )
  ) into v_result
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  left join public.organizations o on o.id = p.organization_id
  where p.id = auth.uid();

  return v_result;
end;
$$;
