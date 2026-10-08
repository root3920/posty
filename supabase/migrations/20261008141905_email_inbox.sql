-- =============================================================
-- POSTY — Email Inbox (Fase A)
-- Tables: email_aliases, email_threads, email_webhook_events
-- Alter: email_messages (add threading + inbound columns)
-- Alter: organizations (add email_forward_inbound)
-- Functions: get_email_unread_count, mark_email_thread_read,
--            assign_email_thread, set_email_thread_status
-- Permissions: email.view, email.manage
-- Storage: email-attachments bucket
-- Realtime: email_threads, email_messages
-- =============================================================

-- -----------------------------------------------
-- 1. Add email_forward_inbound to organizations
-- -----------------------------------------------
alter table public.organizations
  add column if not exists email_forward_inbound boolean not null default true;

-- -----------------------------------------------
-- 2. email_aliases — one per org, maps alias → org
-- -----------------------------------------------
create table public.email_aliases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  alias text not null,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_email_alias unique (alias),
  constraint uq_email_alias_org unique (organization_id),
  constraint chk_email_alias_format check (
    alias ~ '^[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]$'
  )
);

create index idx_email_aliases_alias on public.email_aliases(alias);

alter table public.email_aliases enable row level security;

create policy "View email_aliases of own org"
  on public.email_aliases for select
  using (organization_id = public.current_org_id());

create policy "Manage email_aliases own org"
  on public.email_aliases for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 3. email_threads — conversation threads
-- -----------------------------------------------
create table public.email_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null,
  subject text not null default '(sin asunto)',
  status text not null default 'open'
    check (status in ('open', 'closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz,
  unread_count int not null default 0,
  token text not null,
  sender_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_email_thread_token unique (token)
);

create index idx_email_threads_org_last on public.email_threads(organization_id, last_message_at desc);
create index idx_email_threads_token on public.email_threads(token);
create index idx_email_threads_guest on public.email_threads(guest_id);
create index idx_email_threads_org_status on public.email_threads(organization_id, status);

alter table public.email_threads enable row level security;

create policy "View email_threads of own org"
  on public.email_threads for select
  using (organization_id = public.current_org_id());

create policy "Insert email_threads own org"
  on public.email_threads for insert
  with check (organization_id = public.current_org_id());

create policy "Update email_threads own org"
  on public.email_threads for update
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 4. Alter email_messages — add threading + inbound
-- -----------------------------------------------
alter table public.email_messages
  add column if not exists thread_id uuid references public.email_threads(id) on delete set null,
  add column if not exists direction text not null default 'out',
  add column if not exists message_id text,
  add column if not exists in_reply_to text,
  add column if not exists references_header text,
  add column if not exists from_address text,
  add column if not exists cc text[],
  add column if not exists html_sanitized text,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists raw_payload jsonb;

-- Add check constraint separately (safe with existing data since all rows are 'out')
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'email_messages_direction_check'
      and conrelid = 'public.email_messages'::regclass
  ) then
    alter table public.email_messages
      add constraint email_messages_direction_check check (direction in ('in', 'out'));
  end if;
end; $$;

create index if not exists idx_email_messages_message_id
  on public.email_messages(message_id) where message_id is not null;

create index if not exists idx_email_messages_thread
  on public.email_messages(thread_id, created_at asc) where thread_id is not null;

-- -----------------------------------------------
-- 5. email_webhook_events — idempotency for inbound
-- -----------------------------------------------
create table public.email_webhook_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- No RLS needed — only accessed by service role in webhook handler

-- -----------------------------------------------
-- 6. Storage bucket: email-attachments (private)
-- -----------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-attachments',
  'email-attachments',
  false,
  10485760,  -- 10 MB
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'text/plain', 'text/csv', 'text/html',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-7z-compressed',
    'application/gzip',
    'message/rfc822',
    'application/octet-stream'
  ]
)
on conflict (id) do nothing;

-- Storage policies: authenticated users from same org can read
create policy "Authenticated users read email attachments"
  on storage.objects for select
  using (
    bucket_id = 'email-attachments'
    and auth.role() = 'authenticated'
  );

-- Admin-only insert (webhook handler uses service role)
create policy "Service role inserts email attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'email-attachments'
    and auth.role() = 'service_role'
  );

-- -----------------------------------------------
-- 7. RPC: get_email_unread_count (sidebar badge)
-- -----------------------------------------------
create or replace function public.get_email_unread_count()
returns int
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(sum(unread_count), 0)::int
  from public.email_threads
  where organization_id = (
    select organization_id from public.profiles where id = auth.uid() limit 1
  )
  and status = 'open';
$$;

grant execute on function public.get_email_unread_count() to authenticated;

-- -----------------------------------------------
-- 8. RPC: mark_email_thread_read
-- -----------------------------------------------
create or replace function public.mark_email_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.email_threads
  set unread_count = 0
  where id = p_thread_id
    and organization_id = (
      select organization_id from public.profiles where id = auth.uid() limit 1
    );
end;
$$;

grant execute on function public.mark_email_thread_read(uuid) to authenticated;

-- -----------------------------------------------
-- 9. RPC: assign_email_thread
-- -----------------------------------------------
create or replace function public.assign_email_thread(
  p_thread_id uuid,
  p_profile_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.email_threads
  set assigned_to = p_profile_id,
      updated_at = now()
  where id = p_thread_id
    and organization_id = (
      select organization_id from public.profiles where id = auth.uid() limit 1
    );
end;
$$;

grant execute on function public.assign_email_thread(uuid, uuid) to authenticated;

-- -----------------------------------------------
-- 10. RPC: set_email_thread_status (open/close)
-- -----------------------------------------------
create or replace function public.set_email_thread_status(
  p_thread_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('open', 'closed') then
    raise exception 'Estado inválido: %', p_status;
  end if;

  update public.email_threads
  set status = p_status,
      updated_at = now()
  where id = p_thread_id
    and organization_id = (
      select organization_id from public.profiles where id = auth.uid() limit 1
    );
end;
$$;

grant execute on function public.set_email_thread_status(uuid, text) to authenticated;

-- -----------------------------------------------
-- 11. Enable Realtime on email tables
-- -----------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'email_threads'
  ) then
    alter publication supabase_realtime add table public.email_threads;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'email_messages'
  ) then
    alter publication supabase_realtime add table public.email_messages;
  end if;
end; $$;

-- -----------------------------------------------
-- 12. Permissions: email.view, email.manage
-- -----------------------------------------------
insert into public.permissions (key, module, action, scope, description) values
  ('email.view', 'email', 'view', null, 'Ver buzón de correo electrónico'),
  ('email.manage', 'email', 'manage', null, 'Administrar configuración de correo (alias, reenvío, dominio)')
on conflict (key) do nothing;

-- -----------------------------------------------
-- 13. Backfill permissions to existing organization roles
-- -----------------------------------------------
do $$
declare
  v_role record;
begin
  -- Gestor: ALL email permissions
  for v_role in
    select id from public.roles
    where system_key = 'manager'
       or (is_system = true and name = 'Gestor')
  loop
    insert into public.role_permissions (role_id, permission_key)
    values
      (v_role.id, 'email.view'),
      (v_role.id, 'email.manage')
    on conflict do nothing;
  end loop;

  -- Recepcionista: email.view (email.send already assigned)
  for v_role in
    select id from public.roles where system_key = 'front_desk'
  loop
    insert into public.role_permissions (role_id, permission_key)
    values
      (v_role.id, 'email.view')
    on conflict do nothing;
  end loop;
end; $$;

-- -----------------------------------------------
-- 14. Update get_my_profile to include email alias
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
      'email_alias', ea.alias
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
-- 15. updated_at trigger for email_threads
-- -----------------------------------------------
create trigger handle_email_threads_updated_at
  before update on public.email_threads
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------
-- 16. updated_at trigger for email_aliases
-- -----------------------------------------------
create trigger handle_email_aliases_updated_at
  before update on public.email_aliases
  for each row execute function public.handle_updated_at();
