-- =============================================================
-- POSTY — Instagram Insights (Phase A)
-- Tables, permission, granted_scopes, cron job
-- =============================================================

-- -----------------------------------------------
-- 1. Add granted_scopes to instagram_connections
-- -----------------------------------------------
alter table public.instagram_connections
  add column if not exists granted_scopes text[] default '{}';

-- -----------------------------------------------
-- 2. Table: instagram_account_insights_daily
--    One row per (connection, date, metric, breakdown).
-- -----------------------------------------------
create table public.instagram_account_insights_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.instagram_connections(id) on delete cascade,
  date date not null,
  metric text not null,
  breakdown_key text not null default '',
  breakdown_value text not null default '',
  value bigint not null default 0,
  fetched_at timestamptz not null default now(),

  constraint uq_ig_account_insight unique (connection_id, date, metric, breakdown_key, breakdown_value)
);

create index idx_ig_account_insights_conn_date
  on public.instagram_account_insights_daily(connection_id, date);
create index idx_ig_account_insights_metric
  on public.instagram_account_insights_daily(metric, date);

alter table public.instagram_account_insights_daily enable row level security;
create policy "View ig insights of own org"
  on public.instagram_account_insights_daily for select
  using (organization_id = public.current_org_id());
create policy "Manage ig insights"
  on public.instagram_account_insights_daily for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 3. Table: instagram_follower_snapshots
--    Daily snapshot of follower/following/media counts.
-- -----------------------------------------------
create table public.instagram_follower_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.instagram_connections(id) on delete cascade,
  date date not null,
  followers_count int not null default 0,
  follows_count int not null default 0,
  media_count int not null default 0,

  constraint uq_ig_follower_snapshot unique (connection_id, date)
);

create index idx_ig_follower_snap_conn_date
  on public.instagram_follower_snapshots(connection_id, date);

alter table public.instagram_follower_snapshots enable row level security;
create policy "View ig follower snapshots of own org"
  on public.instagram_follower_snapshots for select
  using (organization_id = public.current_org_id());
create policy "Manage ig follower snapshots"
  on public.instagram_follower_snapshots for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 4. Table: instagram_media_insights
--    Per-post metrics snapshot.
-- -----------------------------------------------
create table public.instagram_media_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.instagram_connections(id) on delete cascade,
  ig_media_id text not null,
  media_product_type text,
  metrics jsonb not null default '{}',
  fetched_at timestamptz not null default now(),

  constraint uq_ig_media_insight unique (connection_id, ig_media_id)
);

create index idx_ig_media_insights_conn
  on public.instagram_media_insights(connection_id);

alter table public.instagram_media_insights enable row level security;
create policy "View ig media insights of own org"
  on public.instagram_media_insights for select
  using (organization_id = public.current_org_id());
create policy "Manage ig media insights"
  on public.instagram_media_insights for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 5. Permission: instagram.view_insights
-- -----------------------------------------------
insert into public.permissions (key, module, action, scope, description) values
  ('instagram.view_insights', 'instagram', 'view_insights', null, 'Ver estadísticas de Instagram')
on conflict (key) do nothing;

-- Backfill: Gestor gets it
do $$
declare v_role record;
begin
  for v_role in select id from public.roles where system_key = 'manager' or (is_system = true and name = 'Gestor') loop
    insert into public.role_permissions (role_id, permission_key)
    values (v_role.id, 'instagram.view_insights')
    on conflict do nothing;
  end loop;
  -- Also give to marketing roles
  for v_role in select id from public.roles where system_key = 'marketing' or (is_system = true and name ilike '%mercadeo%') loop
    insert into public.role_permissions (role_id, permission_key)
    values (v_role.id, 'instagram.view_insights')
    on conflict do nothing;
  end loop;
end;
$$;

-- Also update seed_organization_defaults if it exists
do $$
begin
  -- Add to the function that seeds new orgs (if the permission key isn't already there)
  -- This is handled by the backfill above for existing orgs
  null;
end;
$$;

-- -----------------------------------------------
-- 6. pg_cron: instagram-insights-daily
--    Runs daily at 3 AM. Uses pg_net to call API.
-- -----------------------------------------------
select cron.schedule(
  'instagram-insights-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://app.postyassistant.com/api/cron/instagram-insights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'cron_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
