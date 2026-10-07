-- =============================================================
-- Add contact_email to get_my_profile() so the email module
-- can read it through the same channel as the rest of the app.
-- =============================================================

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
      'contact_email', o.contact_email
    )
  ) into v_result
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  left join public.organizations o on o.id = p.organization_id
  where p.id = auth.uid();

  return v_result;
end;
$$;
