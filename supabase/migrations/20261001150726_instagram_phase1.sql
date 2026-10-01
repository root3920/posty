-- =============================================================
-- POSTY — Instagram Phase 1: connection, media cache
-- =============================================================

-- -----------------------------------------------
-- 1. Table: instagram_connections
-- -----------------------------------------------
create table public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ig_user_id text not null,
  username text,
  name text,
  profile_picture_url text,
  account_type text,
  media_count int default 0,
  followers_count int default 0,
  follows_count int default 0,
  access_token_encrypted text not null,
  token_expires_at timestamptz not null,
  status text not null default 'connected'
    check (status in ('connected', 'expired', 'disconnected', 'error')),
  connected_at timestamptz not null default now(),
  connected_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ig_connections_org on public.instagram_connections(organization_id);
create index idx_ig_connections_status on public.instagram_connections(status);

create trigger on_ig_connections_updated
  before update on public.instagram_connections
  for each row execute function public.handle_updated_at();

alter table public.instagram_connections enable row level security;
create policy "View ig_connections of own org" on public.instagram_connections for select using (organization_id = public.current_org_id());
create policy "Manage ig_connections" on public.instagram_connections for all using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 2. Table: instagram_media (cache)
-- -----------------------------------------------
create table public.instagram_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.instagram_connections(id) on delete cascade,
  ig_media_id text not null,
  media_type text,
  media_url text,
  thumbnail_url text,
  permalink text,
  caption text,
  "timestamp" timestamptz,
  like_count int default 0,
  comments_count int default 0,
  children jsonb,
  cached_at timestamptz not null default now(),

  constraint uq_ig_media unique (organization_id, ig_media_id)
);

create index idx_ig_media_connection on public.instagram_media(connection_id);
create index idx_ig_media_timestamp on public.instagram_media("timestamp" desc);

alter table public.instagram_media enable row level security;
create policy "View ig_media of own org" on public.instagram_media for select using (organization_id = public.current_org_id());
create policy "Manage ig_media" on public.instagram_media for all using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 3. Permissions
-- -----------------------------------------------
insert into public.permissions (key, module, action, scope, description) values
  ('instagram.view', 'instagram', 'view', null, 'Ver la grilla y publicaciones de Instagram'),
  ('instagram.publish', 'instagram', 'publish', null, 'Crear, programar y publicar en Instagram'),
  ('instagram.manage_connection', 'instagram', 'manage_connection', null, 'Conectar o desconectar Instagram')
on conflict (key) do nothing;

-- Backfill: Gestor gets all
do $$
declare v_role record;
begin
  for v_role in select id from public.roles where system_key = 'manager' or (is_system = true and name = 'Gestor') loop
    insert into public.role_permissions (role_id, permission_key)
    select v_role.id, p.key from public.permissions p where p.module = 'instagram'
    on conflict do nothing;
  end loop;
  -- All other roles get view
  for v_role in select id from public.roles where system_key is null or system_key not in ('manager') loop
    insert into public.role_permissions (role_id, permission_key) values (v_role.id, 'instagram.view')
    on conflict do nothing;
  end loop;
end;
$$;

-- -----------------------------------------------
-- 4. Function: refresh_instagram_tokens (called by cron)
-- -----------------------------------------------
create or replace function public.refresh_instagram_tokens()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_conn record;
begin
  -- Find tokens expiring within 7 days
  for v_conn in
    select id, organization_id from public.instagram_connections
    where status = 'connected'
      and token_expires_at < now() + interval '7 days'
  loop
    -- Mark for refresh — actual refresh happens via the API route
    -- because we need to call graph.instagram.com from the server
    update public.instagram_connections
    set status = 'expired'
    where id = v_conn.id
      and token_expires_at < now();
  end loop;
end;
$$;

-- Schedule token check daily at 2 AM
select cron.schedule(
  'instagram-token-refresh',
  '0 2 * * *',
  $$select public.refresh_instagram_tokens()$$
);
