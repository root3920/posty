-- =============================================================
-- POSTY — Instagram Phase 2: posts, publishing, storage
-- =============================================================

-- -----------------------------------------------
-- 1. Table: instagram_posts
-- -----------------------------------------------
create table public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.instagram_connections(id) on delete cascade,
  type text not null default 'IMAGE' check (type in ('IMAGE', 'CAROUSEL_ALBUM', 'VIDEO', 'REELS')),
  caption text,
  media jsonb not null default '[]',
  aspect_ratio text default '1:1',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  scheduled_at timestamptz,
  container_id text,
  ig_media_id text,
  permalink text,
  published_at timestamptz,
  error text,
  attempts int not null default 0,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ig_posts_org on public.instagram_posts(organization_id);
create index idx_ig_posts_status on public.instagram_posts(status);
create index idx_ig_posts_scheduled on public.instagram_posts(scheduled_at) where status = 'scheduled';

create trigger on_ig_posts_updated
  before update on public.instagram_posts
  for each row execute function public.handle_updated_at();

alter table public.instagram_posts enable row level security;
create policy "View ig_posts of own org" on public.instagram_posts for select using (organization_id = public.current_org_id());
create policy "Manage ig_posts" on public.instagram_posts for all using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 2. Table: instagram_api_logs
-- -----------------------------------------------
create table public.instagram_api_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  post_id uuid references public.instagram_posts(id) on delete set null,
  endpoint text not null,
  method text not null default 'POST',
  status_code int,
  request_body jsonb,
  response_body jsonb,
  created_at timestamptz not null default now()
);

create index idx_ig_api_logs_post on public.instagram_api_logs(post_id);

alter table public.instagram_api_logs enable row level security;
create policy "View ig_api_logs of own org" on public.instagram_api_logs for select using (organization_id = public.current_org_id());
create policy "Manage ig_api_logs" on public.instagram_api_logs for all using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 3. Storage bucket: instagram-media (public read)
-- -----------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'instagram-media',
  'instagram-media',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Storage policies: authenticated users can upload, public can read
create policy "Public read instagram-media" on storage.objects for select
  using (bucket_id = 'instagram-media');

create policy "Authenticated upload instagram-media" on storage.objects for insert
  with check (bucket_id = 'instagram-media' and auth.role() = 'authenticated');

create policy "Authenticated delete instagram-media" on storage.objects for delete
  using (bucket_id = 'instagram-media' and auth.role() = 'authenticated');
