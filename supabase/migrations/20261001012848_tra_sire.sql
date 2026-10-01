-- =============================================================
-- POSTY — TRA (Tarjeta de Registro de Alojamiento) & SIRE
-- Regulatory compliance for Colombian hotels
-- =============================================================

-- -----------------------------------------------
-- 1. Extend guests with required regulatory fields
-- -----------------------------------------------
alter table public.guests
  add column if not exists gender text check (gender in ('M', 'F', 'O')),
  add column if not exists residence_city text,
  add column if not exists residence_country text;

-- -----------------------------------------------
-- 2. Add DIAN codes to document_types
-- -----------------------------------------------
alter table public.document_types
  add column if not exists dian_code text;

-- Update existing system document types with DIAN codes
update public.document_types set dian_code = '13' where code = 'CC' and dian_code is null;
update public.document_types set dian_code = '22' where code = 'CE' and dian_code is null;
update public.document_types set dian_code = '91' where code = 'PA' and dian_code is null;
update public.document_types set dian_code = '12' where code = 'TI' and dian_code is null;
update public.document_types set dian_code = '31' where code = 'NIT' and dian_code is null;
update public.document_types set dian_code = '41' where code = 'PEP' and dian_code is null;

-- -----------------------------------------------
-- 3. Extend organizations with RNT and regulatory settings
-- -----------------------------------------------
alter table public.organizations
  add column if not exists rnt_number text,
  add column if not exists rnt_category text,
  add column if not exists tra_api_token text,
  add column if not exists sire_enabled boolean not null default false,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists department text;

-- -----------------------------------------------
-- 4. Table: tra_submissions
-- -----------------------------------------------
create table public.tra_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stay_id uuid not null references public.stays(id) on delete cascade,
  guest_id uuid not null references public.guests(id),
  tra_api_id text,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'confirmed', 'error')),
  request_payload jsonb,
  response_payload jsonb,
  submitted_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_tra_submissions_org on public.tra_submissions(organization_id);
create index idx_tra_submissions_stay on public.tra_submissions(stay_id);
create index idx_tra_submissions_status on public.tra_submissions(status);

alter table public.tra_submissions enable row level security;
create policy "View TRA of own org" on public.tra_submissions for select using (organization_id = public.current_org_id());
create policy "Manage TRA" on public.tra_submissions for all using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 5. Table: sire_submissions
-- -----------------------------------------------
create table public.sire_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stay_id uuid not null references public.stays(id) on delete cascade,
  guest_id uuid not null references public.guests(id),
  submission_type text not null check (submission_type in ('check_in', 'check_out', 'cancellation')),
  status text not null default 'pending' check (status in ('pending', 'submitted', 'confirmed', 'error')),
  file_content text,
  submitted_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_sire_submissions_org on public.sire_submissions(organization_id);
create index idx_sire_submissions_stay on public.sire_submissions(stay_id);

alter table public.sire_submissions enable row level security;
create policy "View SIRE of own org" on public.sire_submissions for select using (organization_id = public.current_org_id());
create policy "Manage SIRE" on public.sire_submissions for all using (organization_id = public.current_org_id());

-- -----------------------------------------------
-- 6. Function: submit_tra
-- -----------------------------------------------
create or replace function public.submit_tra(p_stay_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_stay record;
  v_guest record;
  v_doc_type record;
  v_travel_reason text;
  v_channel text;
  v_room_number text;
  v_submission_id uuid;
  v_payload jsonb;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  -- Get stay with all related data
  select s.*, r.number as room_number into v_stay
  from public.stays s
  join public.rooms r on r.id = s.room_id
  where s.id = p_stay_id and s.organization_id = v_org_id;

  if not found then raise exception 'Estancia no encontrada'; end if;

  -- Get guest
  select * into v_guest from public.guests where id = v_stay.primary_guest_id;
  if not found then raise exception 'Huésped no encontrado'; end if;

  -- Get document type
  select * into v_doc_type from public.document_types where id = v_guest.document_type_id;

  -- Get travel reason name
  select name into v_travel_reason from public.travel_reasons where id = v_stay.travel_reason_id;

  -- Get channel name
  select name into v_channel from public.booking_channels where id = v_stay.channel_id;

  -- Build TRA payload
  v_payload := jsonb_build_object(
    'tipo_documento', coalesce(v_doc_type.dian_code, v_doc_type.code),
    'numero_documento', v_guest.document_number,
    'primer_nombre', v_guest.first_name,
    'primer_apellido', v_guest.last_name,
    'sexo', v_guest.gender,
    'fecha_nacimiento', v_guest.birth_date,
    'nacionalidad', v_guest.nationality,
    'pais_residencia', coalesce(v_guest.residence_country, v_guest.country_of_origin),
    'ciudad_residencia', coalesce(v_guest.residence_city, v_guest.city_of_origin),
    'pais_procedencia', v_guest.country_of_origin,
    'ciudad_procedencia', v_guest.city_of_origin,
    'motivo_viaje', coalesce(v_travel_reason, 'Turismo'),
    'numero_habitacion', v_stay.room_number,
    'fecha_entrada', v_stay.check_in_date,
    'fecha_salida', v_stay.check_out_date,
    'tarifa', v_stay.rate_per_night,
    'canal_reserva', coalesce(v_channel, 'Directo'),
    'adultos', v_stay.adults,
    'menores', v_stay.children
  );

  -- Create submission record
  insert into public.tra_submissions (
    organization_id, stay_id, guest_id, status, request_payload
  ) values (
    v_org_id, p_stay_id, v_guest.id, 'pending', v_payload
  )
  returning id into v_submission_id;

  return json_build_object(
    'success', true,
    'submission_id', v_submission_id,
    'payload', v_payload
  );
end;
$$;

grant execute on function public.submit_tra(uuid) to authenticated;

-- -----------------------------------------------
-- 7. Function: generate_sire_record
-- -----------------------------------------------
create or replace function public.generate_sire_record(
  p_stay_id uuid,
  p_type text default 'check_in'
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_stay record;
  v_guest record;
  v_doc_type record;
  v_org record;
  v_submission_id uuid;
  v_line text;
begin
  v_user_id := auth.uid();
  select organization_id into v_org_id from public.profiles where id = v_user_id limit 1;

  select s.*, r.number as room_number into v_stay
  from public.stays s join public.rooms r on r.id = s.room_id
  where s.id = p_stay_id and s.organization_id = v_org_id;
  if not found then raise exception 'Estancia no encontrada'; end if;

  select * into v_guest from public.guests where id = v_stay.primary_guest_id;
  if not found then raise exception 'Huésped no encontrado'; end if;

  -- Only for foreign guests
  if v_guest.nationality is not null and upper(v_guest.nationality) = 'CO' then
    return json_build_object('skipped', true, 'reason', 'Huésped colombiano — SIRE no aplica');
  end if;

  select * into v_doc_type from public.document_types where id = v_guest.document_type_id;
  select * into v_org from public.organizations where id = v_org_id;

  -- Build SIRE line (pipe-delimited format)
  v_line := concat_ws('|',
    p_type, -- tipo_movimiento
    to_char(now(), 'YYYY-MM-DD'), -- fecha_movimiento
    v_guest.first_name,
    v_guest.last_name,
    coalesce(v_doc_type.code, 'PA'),
    v_guest.document_number,
    v_guest.nationality,
    to_char(v_guest.birth_date, 'YYYY-MM-DD'),
    v_guest.gender,
    coalesce(v_guest.residence_city, ''),
    coalesce(v_guest.country_of_origin, ''),
    coalesce(v_guest.city_of_origin, ''),
    to_char(v_stay.check_in_date, 'YYYY-MM-DD'),
    to_char(v_stay.check_out_date, 'YYYY-MM-DD'),
    v_stay.room_number,
    coalesce(v_org.rnt_number, ''),
    coalesce(v_org.name, '')
  );

  insert into public.sire_submissions (
    organization_id, stay_id, guest_id, submission_type, status, file_content
  ) values (
    v_org_id, p_stay_id, v_guest.id, p_type, 'pending', v_line
  )
  returning id into v_submission_id;

  return json_build_object(
    'success', true,
    'submission_id', v_submission_id,
    'line', v_line,
    'is_foreign', true
  );
end;
$$;

grant execute on function public.generate_sire_record(uuid, text) to authenticated;

-- -----------------------------------------------
-- 8. Function: export_sire_file (bulk for a date range)
-- -----------------------------------------------
create or replace function public.export_sire_file(
  p_date_from date,
  p_date_to date
)
returns text
language sql security definer stable set search_path = public
as $$
  select string_agg(file_content, E'\n' order by created_at)
  from public.sire_submissions
  where organization_id = (select organization_id from public.profiles where id = auth.uid() limit 1)
    and created_at::date between p_date_from and p_date_to
    and file_content is not null;
$$;

grant execute on function public.export_sire_file(date, date) to authenticated;

-- -----------------------------------------------
-- 9. Permissions
-- -----------------------------------------------
insert into public.permissions (key, module, action, scope, description) values
  ('regulatory.view', 'regulatory', 'view', null, 'Ver TRA y SIRE'),
  ('regulatory.submit', 'regulatory', 'submit', null, 'Enviar TRA y generar SIRE'),
  ('regulatory.configure', 'regulatory', 'configure', null, 'Configurar RNT y credenciales regulatorias')
on conflict (key) do nothing;

-- Backfill: Gestor gets all, Recepcionista gets view + submit
do $$
declare v_role record;
begin
  for v_role in select id from public.roles where system_key = 'manager' or (is_system = true and name = 'Gestor') loop
    insert into public.role_permissions (role_id, permission_key) values
      (v_role.id, 'regulatory.view'), (v_role.id, 'regulatory.submit'), (v_role.id, 'regulatory.configure')
    on conflict do nothing;
  end loop;
  for v_role in select id from public.roles where system_key = 'front_desk' loop
    insert into public.role_permissions (role_id, permission_key) values
      (v_role.id, 'regulatory.view'), (v_role.id, 'regulatory.submit')
    on conflict do nothing;
  end loop;
end;
$$;
