-- =============================================================
-- POSTY — Chat: Delete conversations
-- =============================================================

-- -----------------------------------------------
-- 1. Add cleared_at to chat_contacts
-- Messages older than cleared_at are ignored by the webhook
-- -----------------------------------------------
alter table public.chat_contacts
  add column if not exists cleared_at timestamptz;

-- -----------------------------------------------
-- 2. Permission: chat.delete_conversations
-- -----------------------------------------------
insert into public.permissions (key, module, action, scope, description) values
  ('chat.delete_conversations', 'chat', 'delete_conversations', null, 'Eliminar conversaciones de chat')
on conflict (key) do nothing;

-- Backfill: Gestor gets it
do $$
declare v_role record;
begin
  for v_role in select id from public.roles where system_key = 'manager' or (is_system = true and name = 'Gestor') loop
    insert into public.role_permissions (role_id, permission_key)
    values (v_role.id, 'chat.delete_conversations')
    on conflict do nothing;
  end loop;
end;
$$;

-- -----------------------------------------------
-- 3. RPC: delete_chat_conversation (single)
-- -----------------------------------------------
create or replace function public.delete_chat_conversation(p_conversation_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_conv record;
  v_msg_count int;
  v_note_count int;
  v_contact_deleted boolean := false;
  v_media_paths text[];
begin
  -- Auth
  if v_user_id is null then raise exception 'No autenticado'; end if;
  select organization_id into v_org_id from public.profiles where id = v_user_id;
  if v_org_id is null then raise exception 'Sin organización'; end if;

  -- Permission check
  if not public.has_permission('chat.delete_conversations') then
    raise exception 'No tienes permiso para eliminar conversaciones';
  end if;

  -- Get conversation (org-scoped)
  select c.id, c.contact_id, c.contact_name, c.contact_phone_e164, c.guest_id
  into v_conv
  from public.chat_conversations c
  where c.id = p_conversation_id and c.organization_id = v_org_id;

  if v_conv is null then
    raise exception 'Conversación no encontrada';
  end if;

  -- Collect media paths for later storage cleanup (returned to caller)
  select array_agg(media_path) filter (where media_path is not null)
  into v_media_paths
  from public.chat_messages
  where conversation_id = p_conversation_id;

  -- Count for audit
  select count(*) into v_msg_count from public.chat_messages where conversation_id = p_conversation_id;
  select count(*) into v_note_count from public.chat_notes where conversation_id = p_conversation_id;

  -- Set cleared_at on the contact (prevents old messages from re-creating the conversation)
  if v_conv.contact_id is not null then
    update public.chat_contacts
    set cleared_at = now()
    where id = v_conv.contact_id;
  end if;

  -- Delete messages (notes cascade via FK on conversation)
  delete from public.chat_messages where conversation_id = p_conversation_id;
  delete from public.chat_notes where conversation_id = p_conversation_id;

  -- Delete conversation
  delete from public.chat_conversations where id = p_conversation_id;

  -- Delete contact if NOT linked to a guest
  if v_conv.contact_id is not null and v_conv.guest_id is null then
    -- Check if the contact has other conversations
    if not exists (
      select 1 from public.chat_conversations where contact_id = v_conv.contact_id
    ) then
      delete from public.chat_contacts where id = v_conv.contact_id;
      v_contact_deleted := true;
    end if;
  end if;

  -- Audit log (no message content — only counts)
  insert into public.audit_log (
    organization_id, entity_type, entity_id, action, after, actor_id
  ) values (
    v_org_id, 'chat_conversation', p_conversation_id, 'deleted',
    json_build_object(
      'contact_name', v_conv.contact_name,
      'contact_phone', v_conv.contact_phone_e164,
      'messages_deleted', v_msg_count,
      'notes_deleted', v_note_count,
      'contact_deleted', v_contact_deleted
    )::jsonb,
    v_user_id
  );

  return json_build_object(
    'success', true,
    'messages_deleted', v_msg_count,
    'notes_deleted', v_note_count,
    'contact_deleted', v_contact_deleted,
    'media_paths', coalesce(v_media_paths, array[]::text[])
  );
end;
$$;

-- -----------------------------------------------
-- 4. RPC: delete_chat_conversations_bulk
-- -----------------------------------------------
create or replace function public.delete_chat_conversations_bulk(p_conversation_ids uuid[])
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_total_messages int := 0;
  v_total_contacts int := 0;
  v_count int := 0;
  v_result json;
begin
  -- Limit batch size
  if array_length(p_conversation_ids, 1) > 50 then
    raise exception 'Máximo 50 conversaciones por lote';
  end if;

  foreach v_id in array p_conversation_ids loop
    v_result := public.delete_chat_conversation(v_id);
    v_total_messages := v_total_messages + (v_result->>'messages_deleted')::int;
    if (v_result->>'contact_deleted')::boolean then
      v_total_contacts := v_total_contacts + 1;
    end if;
    v_count := v_count + 1;
  end loop;

  return json_build_object(
    'success', true,
    'conversations_deleted', v_count,
    'total_messages_deleted', v_total_messages,
    'contacts_deleted', v_total_contacts
  );
end;
$$;
