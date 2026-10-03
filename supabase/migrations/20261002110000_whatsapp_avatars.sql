-- =============================================================
-- POSTY — WhatsApp Avatars: columns, bucket, cleanup
-- =============================================================

-- -----------------------------------------------
-- 1. New columns on chat_contacts
-- -----------------------------------------------
alter table public.chat_contacts
  add column if not exists avatar_path text,
  add column if not exists avatar_status text not null default 'pending'
    check (avatar_status in ('ok', 'none', 'error', 'pending')),
  add column if not exists avatar_fetched_at timestamptz;

-- -----------------------------------------------
-- 2. Private bucket: whatsapp-avatars
-- -----------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-avatars',
  'whatsapp-avatars',
  false,               -- PRIVATE — served via signed URLs
  524288,              -- 512 KB max (96x96 webp is tiny)
  array['image/webp']
)
on conflict (id) do nothing;

-- RLS policies: only authenticated users from the same org can read
create policy "Authenticated read whatsapp-avatars"
  on storage.objects for select
  using (
    bucket_id = 'whatsapp-avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "Service role manage whatsapp-avatars"
  on storage.objects for all
  using (bucket_id = 'whatsapp-avatars')
  with check (bucket_id = 'whatsapp-avatars');

-- -----------------------------------------------
-- 3. Function: cleanup avatars on disconnect
--    Called by close_whatsapp_session or manually
-- -----------------------------------------------
create or replace function public.clear_whatsapp_avatars(p_connection_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Clear avatar columns for all contacts linked to conversations of this connection
  update public.chat_contacts c
  set avatar_path = null,
      avatar_status = 'pending',
      avatar_fetched_at = null
  from public.chat_conversations conv
  where conv.connection_id = p_connection_id
    and conv.contact_id = c.id;
  -- Note: actual file deletion from storage bucket happens in the API route
  -- because PL/pgSQL cannot call the storage API directly
end;
$$;

-- -----------------------------------------------
-- 4. Index for efficient avatar queue queries
-- -----------------------------------------------
create index if not exists idx_chat_contacts_avatar_pending
  on public.chat_contacts(avatar_status, avatar_fetched_at)
  where avatar_status in ('pending', 'error');
