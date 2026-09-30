-- =============================================================
-- POSTY — WhatsApp Session Lifecycle
-- Each connection is an isolated session. Disconnect = clean slate.
-- =============================================================

-- -----------------------------------------------
-- 1. Extend whatsapp_connections for session model
-- -----------------------------------------------
alter table public.whatsapp_connections
  add column if not exists disconnected_at timestamptz,
  add column if not exists disconnect_reason text;

-- Change status to text (was enum, need more values)
-- The enum wa_connection_status has: pending_qr, connecting, connected, disconnected, banned, error
-- We need to add: disconnected_pending, closed
alter type public.wa_connection_status add value if not exists 'disconnected_pending';
alter type public.wa_connection_status add value if not exists 'closed';

-- COMMIT the enum changes so they can be used in subsequent statements
-- (PostgreSQL requires enum values to be committed before use)

-- -----------------------------------------------
-- 2. Table: guest_chat_archives
-- -----------------------------------------------
create table if not exists public.guest_chat_archives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  guest_name text,
  phone_e164 text,
  connection_phone text,
  messages jsonb not null default '[]',
  period_start timestamptz,
  period_end timestamptz,
  archived_at timestamptz not null default now(),
  archived_by uuid references public.profiles(id)
);

create index idx_guest_chat_archives_guest on public.guest_chat_archives(guest_id);

alter table public.guest_chat_archives enable row level security;
create policy "View archives of own org" on public.guest_chat_archives for select using (organization_id = public.current_org_id());
create policy "Manage archives" on public.guest_chat_archives for all using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 3. Function: close_whatsapp_session
-- -----------------------------------------------
create or replace function public.close_whatsapp_session(
  p_connection_id uuid,
  p_reason text default 'user',
  p_archive_guests boolean default true
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_conn record;
  v_conv record;
  v_msg_count int := 0;
  v_conv_count int := 0;
  v_archived int := 0;
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  select * into v_conn from public.whatsapp_connections where id = p_connection_id;
  if not found then raise exception 'Conexión no encontrada'; end if;

  -- Archive guest conversations if requested
  if p_archive_guests then
    for v_conv in
      select c.id, c.guest_id, c.contact_phone_e164, cc.phone_e164 as contact_phone,
             g.first_name || ' ' || g.last_name as guest_name
      from public.chat_conversations c
      left join public.chat_contacts cc on cc.id = c.contact_id
      left join public.guests g on g.id = c.guest_id
      where c.connection_id = p_connection_id and c.guest_id is not null
    loop
      insert into public.guest_chat_archives (
        organization_id, guest_id, guest_name, phone_e164, connection_phone,
        messages, period_start, period_end, archived_by
      )
      select
        v_conn.organization_id, v_conv.guest_id, v_conv.guest_name,
        v_conv.contact_phone, v_conn.phone_e164,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'direction', m.direction, 'type', m.type, 'body', m.body,
            'status', m.status, 'created_at', m.created_at
          ) order by m.created_at)
          from public.chat_messages m where m.conversation_id = v_conv.id
        ), '[]'::jsonb),
        v_conn.connected_at, now(), v_user_id;

      v_archived := v_archived + 1;
    end loop;
  end if;

  -- Delete messages
  delete from public.chat_messages
  where conversation_id in (
    select id from public.chat_conversations where connection_id = p_connection_id
  );
  get diagnostics v_msg_count = row_count;

  -- Delete notes
  delete from public.chat_notes
  where conversation_id in (
    select id from public.chat_conversations where connection_id = p_connection_id
  );

  -- Delete conversations
  delete from public.chat_conversations where connection_id = p_connection_id;
  get diagnostics v_conv_count = row_count;

  -- Update connection (use text assignment — enum value was added in this migration)
  update public.whatsapp_connections set
    status = 'disconnected',
    disconnected_at = now(),
    disconnect_reason = p_reason
  where id = p_connection_id;

  -- Audit log
  insert into public.audit_log (organization_id, entity_type, entity_id, action, after, actor_id, reason)
  values (
    v_conn.organization_id, 'whatsapp_connection', p_connection_id, 'session_closed',
    jsonb_build_object('conversations_deleted', v_conv_count, 'messages_deleted', v_msg_count, 'guests_archived', v_archived),
    v_user_id, p_reason
  );

  return json_build_object(
    'success', true,
    'conversations_deleted', v_conv_count,
    'messages_deleted', v_msg_count,
    'guests_archived', v_archived
  );
end;
$$;

grant execute on function public.close_whatsapp_session(uuid, text, boolean) to authenticated;
grant execute on function public.close_whatsapp_session(uuid, text, boolean) to service_role;

-- -----------------------------------------------
-- 4. Cleanup current state: close old sessions, remove pre-connect messages
-- -----------------------------------------------
do $$
declare
  v_conn record;
begin
  -- Close all disconnected sessions (from before this migration)
  -- Use text cast to avoid "unsafe use of new enum value" error
  update public.whatsapp_connections
  set status = 'disconnected', disconnected_at = coalesce(disconnected_at, now())
  where status::text = 'disconnected';

  -- For connected sessions: delete messages older than connected_at
  for v_conn in
    select id, connected_at, organization_id from public.whatsapp_connections
    where status = 'connected'::wa_connection_status and connected_at is not null
  loop
    delete from public.chat_messages
    where conversation_id in (
      select id from public.chat_conversations where connection_id = v_conn.id
    )
    and created_at < v_conn.connected_at;
  end loop;

  -- Delete conversations with no messages (empty from import)
  delete from public.chat_conversations
  where id not in (select distinct conversation_id from public.chat_messages);
end;
$$;

-- -----------------------------------------------
-- 5. pg_cron: cleanup stale disconnected sessions after 7 days
-- -----------------------------------------------
select cron.schedule(
  'cleanup_stale_whatsapp_sessions',
  '0 3 * * *',
  $$
  do $job$
  declare v_conn record;
  begin
    for v_conn in
      select id from public.whatsapp_connections
      where status::text = 'disconnected_pending'
        and updated_at < now() - interval '7 days'
    loop
      perform public.close_whatsapp_session(v_conn.id, 'inactivity', true);
    end loop;
  end;
  $job$
  $$
);
