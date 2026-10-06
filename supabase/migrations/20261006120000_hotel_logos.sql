-- =============================================================
-- POSTY — Hotel logo upload: bucket + logo_path column
-- =============================================================

-- 1. Add logo_path to organizations (stores the storage path for deletion)
alter table public.organizations
  add column if not exists logo_path text;

-- 2. Public bucket for hotel logos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hotel-logos',
  'hotel-logos',
  true,                -- Public read (logos appear in docs, sidebar, etc.)
  2097152,             -- 2 MB max
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- 3. Storage policies: public read, org-scoped write
create policy "Public read hotel-logos"
  on storage.objects for select
  using (bucket_id = 'hotel-logos');

create policy "Org members upload hotel-logos"
  on storage.objects for insert
  with check (
    bucket_id = 'hotel-logos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "Org members delete hotel-logos"
  on storage.objects for delete
  using (
    bucket_id = 'hotel-logos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );
