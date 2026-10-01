-- =============================================================
-- POSTY — Instagram Phase 3: scheduling, publisher, heartbeat
-- =============================================================

-- -----------------------------------------------
-- 1. Alter instagram_posts: new columns + statuses
-- -----------------------------------------------

-- Add processing and canceled to the status check constraint
alter table public.instagram_posts
  drop constraint if exists instagram_posts_status_check;
alter table public.instagram_posts
  add constraint instagram_posts_status_check
  check (status in ('draft', 'scheduled', 'publishing', 'processing', 'published', 'failed', 'canceled'));

-- New columns for the publisher
alter table public.instagram_posts
  add column if not exists children_container_ids jsonb,
  add column if not exists last_error_code text,
  add column if not exists locked_at timestamptz,
  add column if not exists next_attempt_at timestamptz;

-- Index for the publisher to find due posts efficiently
create index if not exists idx_ig_posts_due
  on public.instagram_posts (scheduled_at)
  where status = 'scheduled';

-- -----------------------------------------------
-- 2. Table: instagram_publisher_heartbeat
-- -----------------------------------------------
create table if not exists public.instagram_publisher_heartbeat (
  id int primary key default 1 check (id = 1), -- singleton row
  last_run_at timestamptz not null default now(),
  processed int not null default 0,
  errors int not null default 0,
  updated_at timestamptz not null default now()
);

-- Seed the singleton row
insert into public.instagram_publisher_heartbeat (id) values (1)
on conflict (id) do nothing;

-- No RLS needed — read by authenticated users, written only by service role
alter table public.instagram_publisher_heartbeat enable row level security;
create policy "Anyone can read heartbeat"
  on public.instagram_publisher_heartbeat for select
  using (true);

-- -----------------------------------------------
-- 3. Function: claim_due_instagram_posts
--    Atomically claims up to p_limit posts that are
--    due for publishing. Uses FOR UPDATE SKIP LOCKED
--    so concurrent runs never claim the same post.
-- -----------------------------------------------
create or replace function public.claim_due_instagram_posts(p_limit int default 5)
returns setof public.instagram_posts
language plpgsql security definer set search_path = public
as $$
begin
  return query
  with claimed as (
    select id
    from public.instagram_posts
    where status = 'scheduled'
      and scheduled_at <= now()
      and (next_attempt_at is null or next_attempt_at <= now())
    order by scheduled_at asc
    limit p_limit
    for update skip locked
  )
  update public.instagram_posts p
  set
    status = 'processing',
    locked_at = now(),
    updated_at = now()
  from claimed c
  where p.id = c.id
  returning p.*;
end;
$$;

-- -----------------------------------------------
-- 4. Function: unstick_instagram_posts
--    Recovers posts stuck in processing for >10 min.
--    Called by the publisher before claiming new posts.
-- -----------------------------------------------
create or replace function public.unstick_instagram_posts()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  with stuck as (
    select id
    from public.instagram_posts
    where status = 'processing'
      and locked_at < now() - interval '10 minutes'
      and ig_media_id is null
    for update skip locked
  )
  update public.instagram_posts p
  set
    status = 'scheduled',
    locked_at = null,
    attempts = attempts + 1,
    updated_at = now()
  from stuck s
  where p.id = s.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------
-- 5. Function: on_instagram_disconnect
--    Moves scheduled posts to draft when account
--    is disconnected.
-- -----------------------------------------------
create or replace function public.on_instagram_disconnect()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'disconnected' and old.status = 'connected' then
    update public.instagram_posts
    set
      status = 'draft',
      error = 'Se pasaron a borrador porque se desconectó Instagram',
      updated_at = now()
    where connection_id = new.id
      and status in ('scheduled', 'failed');
  end if;
  return new;
end;
$$;

create trigger trg_ig_disconnect_move_to_draft
  after update of status on public.instagram_connections
  for each row
  when (new.status = 'disconnected' and old.status = 'connected')
  execute function public.on_instagram_disconnect();

-- -----------------------------------------------
-- 6. pg_cron job: instagram-publish (every minute)
--    Uses pg_net to call the API endpoint.
--    The CRON_SECRET is read from Supabase Vault.
-- -----------------------------------------------

-- NOTE: The secret must be created manually in Supabase SQL Editor:
--   select vault.create_secret('YOUR_CRON_SECRET_HERE', 'cron_secret', 'Bearer token for cron endpoints');
-- See delivery instructions at the end.

-- Schedule the job. It calls the API via pg_net.
select cron.schedule(
  'instagram-publish',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://app.postyassistant.com/api/cron/instagram-publish',
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
