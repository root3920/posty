-- =============================================================
-- POSTY — Email alias backfill + auto-create trigger
--
-- 1. Backfill email_aliases for all existing organizations
-- 2. Trigger on organizations INSERT to auto-create alias
-- =============================================================

-- Enable unaccent extension (strips diacritics in alias generation)
create extension if not exists unaccent schema public;

-- -----------------------------------------------
-- 1. Helper: generate_email_alias(org_name)
--    Pure SQL version of lib/email/alias.ts logic
-- -----------------------------------------------
create or replace function public.generate_email_alias(p_org_name text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_slug text;
  v_candidate text;
  v_suffix int := 0;
  v_reserved text[] := array[
    'admin', 'postmaster', 'abuse', 'noreply', 'no-reply',
    'soporte', 'support', 'info', 'posty', 'security',
    'billing', 'help', 'webmaster', 'hostmaster',
    'mailer-daemon', 'root', 'system', 'test', 'mail',
    'email', 'contact', 'contacto', 'ventas', 'sales'
  ];
begin
  -- Normalize: lowercase, strip diacritics, keep alnum + spaces/hyphens
  v_slug := lower(unaccent(p_org_name));
  v_slug := regexp_replace(v_slug, '[^a-z0-9\s\-]', '', 'g');
  v_slug := regexp_replace(v_slug, '\s+', '-', 'g');
  v_slug := regexp_replace(v_slug, '\-+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  -- Ensure minimum length
  if length(v_slug) < 3 then
    v_slug := v_slug || '000';
    v_slug := left(v_slug, 3);
  end if;

  -- Truncate to max length
  if length(v_slug) > 40 then
    v_slug := left(v_slug, 40);
    v_slug := trim(trailing '-' from v_slug);
  end if;

  v_candidate := v_slug;

  -- If reserved, add suffix
  if v_candidate = any(v_reserved) then
    v_suffix := 1;
    v_candidate := v_slug || '-' || v_suffix;
  end if;

  -- Ensure uniqueness
  while exists (select 1 from email_aliases where alias = v_candidate) loop
    v_suffix := v_suffix + 1;
    v_candidate := v_slug || '-' || v_suffix;
    if v_suffix > 100 then
      -- Extreme fallback
      v_candidate := v_slug || '-' || floor(random() * 9000 + 1000)::int;
      exit;
    end if;
  end loop;

  return v_candidate;
end;
$$;

-- -----------------------------------------------
-- 2. Backfill: create alias for every org without one
-- -----------------------------------------------
do $$
declare
  v_org record;
  v_alias text;
begin
  for v_org in
    select o.id, o.name
    from organizations o
    where not exists (
      select 1 from email_aliases ea
      where ea.organization_id = o.id and ea.active = true
    )
    order by o.created_at
  loop
    v_alias := public.generate_email_alias(v_org.name);

    insert into public.email_aliases (organization_id, alias, active)
    values (v_org.id, v_alias, true)
    on conflict (organization_id) do nothing;

    raise notice 'Alias created: % → %', v_org.name, v_alias;
  end loop;
end; $$;

-- -----------------------------------------------
-- 3. Trigger: auto-create alias on new organization
-- -----------------------------------------------
create or replace function public.on_organization_created_email_alias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alias text;
begin
  v_alias := public.generate_email_alias(new.name);

  insert into public.email_aliases (organization_id, alias, active)
  values (new.id, v_alias, true)
  on conflict (organization_id) do nothing;

  return new;
end;
$$;

-- Drop if exists to be idempotent
drop trigger if exists on_org_created_email_alias on public.organizations;

create trigger on_org_created_email_alias
  after insert on public.organizations
  for each row
  execute function public.on_organization_created_email_alias();
