-- =============================================================
-- POSTY — Email Module (Fase 1)
-- Tables: email_messages, email_suppressions
-- Column: organizations.contact_email
-- Permissions: email.send
-- =============================================================

-- 1. Add contact_email to organizations
alter table public.organizations
  add column if not exists contact_email text;

-- 2. Email messages table
create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null,
  "to" text not null,
  subject text not null,
  template text not null,          -- 'manual', 'test', 'reservation_confirmation', etc.
  body_text text,                  -- plain text body for manual emails
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'bounced', 'complained', 'opened', 'failed')),
  provider_id text,                -- Resend message ID
  error text,
  sent_by uuid references public.profiles(id) on delete set null,
  idempotency_key text,            -- prevent double sends
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_email_idempotency
  on public.email_messages (idempotency_key) where idempotency_key is not null;

create index idx_email_messages_org on public.email_messages(organization_id);
create index idx_email_messages_guest on public.email_messages(guest_id);
create index idx_email_messages_status on public.email_messages(status);
create index idx_email_messages_provider on public.email_messages(provider_id);
create index idx_email_messages_created on public.email_messages(created_at desc);

alter table public.email_messages enable row level security;

create policy "View email_messages of own org"
  on public.email_messages for select
  using (organization_id = public.current_org_id());

create policy "Insert email_messages own org"
  on public.email_messages for insert
  with check (organization_id = public.current_org_id());

create policy "Update email_messages own org"
  on public.email_messages for update
  using (organization_id = public.current_org_id());

-- 3. Email suppressions table (bounces + complaints)
create table public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  reason text not null check (reason in ('bounce', 'complaint', 'unsubscribe')),
  source_message_id uuid references public.email_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint uq_suppression_per_org unique (organization_id, email)
);

create index idx_email_suppressions_org on public.email_suppressions(organization_id);
create index idx_email_suppressions_lookup on public.email_suppressions(organization_id, email);

alter table public.email_suppressions enable row level security;

create policy "View email_suppressions of own org"
  on public.email_suppressions for select
  using (organization_id = public.current_org_id());

create policy "Manage email_suppressions own org"
  on public.email_suppressions for all
  using (organization_id = public.current_org_id());

-- 4. Permissions
insert into public.permissions (key, module, action, scope, description) values
  ('email.send', 'email', 'send', null, 'Enviar correos electrónicos a huéspedes')
on conflict (key) do nothing;

-- 5. Backfill permissions to existing organizations
do $$
declare
  v_role record;
begin
  -- Gestor: ALL permissions (the seed function does this for new orgs)
  for v_role in
    select id from public.roles
    where system_key = 'manager'
       or (is_system = true and name = 'Gestor')
  loop
    insert into public.role_permissions (role_id, permission_key)
    select v_role.id, p.key
    from public.permissions p
    where p.key = 'email.send'
      and not exists (
        select 1 from public.role_permissions rp
        where rp.role_id = v_role.id and rp.permission_key = p.key
      )
    on conflict do nothing;
  end loop;

  -- Recepcionista: email.send
  for v_role in
    select id from public.roles where system_key = 'front_desk'
  loop
    insert into public.role_permissions (role_id, permission_key) values
      (v_role.id, 'email.send')
    on conflict do nothing;
  end loop;
end; $$;
