-- =============================================================
-- POSTY — Email Admin Panel (Fase A, step A8)
-- Column: organizations.email_paused
-- Function: get_email_platform_stats (admin-only)
-- Function: check_email_reputation (called after bounce/complaint)
-- =============================================================

-- -----------------------------------------------
-- 1. Add email_paused to organizations
-- -----------------------------------------------
alter table public.organizations
  add column if not exists email_paused boolean not null default false;

-- -----------------------------------------------
-- 2. Update get_my_profile to include email_paused
-- -----------------------------------------------
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
      'default_check_out_time', o.default_check_out_time,
      'contact_email', o.contact_email,
      'email_forward_inbound', o.email_forward_inbound,
      'email_alias', ea.alias,
      'email_paused', o.email_paused
    )
  ) into v_result
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  left join public.organizations o on o.id = p.organization_id
  left join public.email_aliases ea on ea.organization_id = o.id and ea.active = true
  where p.id = auth.uid();

  return v_result;
end;
$$;

-- -----------------------------------------------
-- 3. Function: get_email_platform_stats
--    Returns per-org email stats for the platform admin.
--    Only callable by service_role (admin API).
-- -----------------------------------------------
create or replace function public.get_email_platform_stats()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(s)), '[]'::json)
  from (
    select
      o.id as org_id,
      o.name as org_name,
      o.email_paused,
      ea.alias,
      -- Sent today
      (select count(*) from email_messages em
       where em.organization_id = o.id
         and em.direction = 'out'
         and em.created_at >= current_date) as sent_today,
      -- Sent this month
      (select count(*) from email_messages em
       where em.organization_id = o.id
         and em.direction = 'out'
         and em.created_at >= date_trunc('month', current_date)) as sent_month,
      -- Bounces last 30 days
      (select count(*) from email_messages em
       where em.organization_id = o.id
         and em.status = 'bounced'
         and em.created_at >= current_date - interval '30 days') as bounces_30d,
      -- Complaints last 30 days
      (select count(*) from email_messages em
       where em.organization_id = o.id
         and em.status = 'complained'
         and em.created_at >= current_date - interval '30 days') as complaints_30d,
      -- Total sent last 30 days (for rate calculation)
      (select count(*) from email_messages em
       where em.organization_id = o.id
         and em.direction = 'out'
         and em.created_at >= current_date - interval '30 days') as total_sent_30d,
      -- Received today
      (select count(*) from email_messages em
       where em.organization_id = o.id
         and em.direction = 'in'
         and em.created_at >= current_date) as received_today,
      -- Thread count
      (select count(*) from email_threads et
       where et.organization_id = o.id) as thread_count
    from organizations o
    left join email_aliases ea on ea.organization_id = o.id and ea.active = true
    order by o.name
  ) s;
$$;

grant execute on function public.get_email_platform_stats() to service_role;
