-- =============================================================
-- POSTY — Chat Phase 0: WhatsApp connection, conversations, messages
-- =============================================================

-- -----------------------------------------------
-- 1. Enums
-- -----------------------------------------------
create type public.wa_connection_status as enum (
  'pending_qr', 'connecting', 'connected', 'disconnected', 'banned', 'error'
);

create type public.wa_provider_type as enum ('evolution_qr', 'meta_cloud');

create type public.wa_account_type as enum ('personal', 'business');

create type public.chat_conversation_status as enum ('open', 'pending', 'closed');

create type public.chat_message_direction as enum ('in', 'out');

create type public.chat_message_type as enum (
  'text', 'image', 'audio', 'video', 'document',
  'sticker', 'location', 'contact', 'unsupported'
);

create type public.chat_message_status as enum (
  'pending', 'sent', 'delivered', 'read', 'failed'
);

create type public.chat_message_source as enum ('posty', 'phone');

create type public.webhook_log_status as enum ('pending', 'processed', 'error');

-- -----------------------------------------------
-- 2. Table: whatsapp_connections
-- -----------------------------------------------
create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider public.wa_provider_type not null default 'evolution_qr',
  instance_name text not null,
  instance_token text,
  account_type public.wa_account_type not null default 'personal',
  phone_e164 text,
  display_name text,
  profile_pic_url text,
  status public.wa_connection_status not null default 'pending_qr',
  last_seen_at timestamptz,
  connected_at timestamptz,
  connected_by uuid references public.profiles(id),
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_wa_connections_org on public.whatsapp_connections(organization_id);
create index idx_wa_connections_status on public.whatsapp_connections(status);

create trigger on_wa_connections_updated
  before update on public.whatsapp_connections
  for each row execute function public.handle_updated_at();

alter table public.whatsapp_connections enable row level security;

create policy "Users can view wa_connections of own org"
  on public.whatsapp_connections for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage wa_connections"
  on public.whatsapp_connections for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 3. Table: whatsapp_webhook_logs
-- -----------------------------------------------
create table public.whatsapp_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  connection_id uuid references public.whatsapp_connections(id) on delete set null,
  event_type text,
  payload jsonb not null,
  status public.webhook_log_status not null default 'pending',
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_wa_webhook_logs_status on public.whatsapp_webhook_logs(status, created_at);

alter table public.whatsapp_webhook_logs enable row level security;

create policy "Users can view wa_webhook_logs of own org"
  on public.whatsapp_webhook_logs for select
  using (organization_id = public.current_org_id());

-- Admin-only insert (service role from webhook handler)
create policy "Service can insert wa_webhook_logs"
  on public.whatsapp_webhook_logs for insert
  with check (true);

-- -----------------------------------------------
-- 4. Table: chat_conversations
-- -----------------------------------------------
create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  contact_phone_e164 text not null,
  contact_name text,
  contact_pic_url text,
  guest_id uuid references public.guests(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  status public.chat_conversation_status not null default 'open',
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int not null default 0,
  is_hidden boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_conversation unique (organization_id, connection_id, contact_phone_e164)
);

create index idx_chat_conversations_org on public.chat_conversations(organization_id);
create index idx_chat_conversations_last_msg on public.chat_conversations(organization_id, last_message_at desc);
create index idx_chat_conversations_guest on public.chat_conversations(guest_id);

create trigger on_chat_conversations_updated
  before update on public.chat_conversations
  for each row execute function public.handle_updated_at();

alter table public.chat_conversations enable row level security;

create policy "Users can view chat_conversations of own org"
  on public.chat_conversations for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage chat_conversations"
  on public.chat_conversations for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 5. Table: chat_messages
-- -----------------------------------------------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  external_id text,
  direction public.chat_message_direction not null,
  type public.chat_message_type not null default 'text',
  body text,
  media_path text,
  media_mime text,
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  status public.chat_message_status not null default 'pending',
  error text,
  sent_by uuid references public.profiles(id),
  sent_from public.chat_message_source,
  created_at timestamptz not null default now(),

  constraint uq_external_id unique (organization_id, external_id)
);

create index idx_chat_messages_conversation on public.chat_messages(conversation_id, created_at);
create index idx_chat_messages_external on public.chat_messages(external_id);

alter table public.chat_messages enable row level security;

create policy "Users can view chat_messages of own org"
  on public.chat_messages for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage chat_messages"
  on public.chat_messages for all
  using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 6. Permissions
-- -----------------------------------------------
insert into public.permissions (key, module, action, scope, description) values
  ('chat.view', 'chat', 'view', null, 'Ver conversaciones asignadas y sin asignar'),
  ('chat.view_all', 'chat', 'view', 'all', 'Ver todas las conversaciones'),
  ('chat.send', 'chat', 'send', null, 'Responder mensajes'),
  ('chat.assign', 'chat', 'assign', null, 'Asignar conversaciones'),
  ('chat.manage_connection', 'chat', 'manage_connection', null, 'Conectar o desconectar WhatsApp');

-- Backfill permissions to existing roles
do $$
declare v_role record;
begin
  -- Gestor: all chat permissions
  for v_role in select id from public.roles where system_key = 'manager' or (is_system = true and name = 'Gestor') loop
    insert into public.role_permissions (role_id, permission_key)
    select v_role.id, p.key from public.permissions p where p.module = 'chat'
    on conflict do nothing;
  end loop;

  -- Recepcionista: view, send, assign
  for v_role in select id from public.roles where system_key = 'front_desk' loop
    insert into public.role_permissions (role_id, permission_key) values
      (v_role.id, 'chat.view'),
      (v_role.id, 'chat.send'),
      (v_role.id, 'chat.assign')
    on conflict do nothing;
  end loop;
end;
$$;
