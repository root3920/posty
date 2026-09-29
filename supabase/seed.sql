-- =============================================================
-- POSTY — DEMO DATA SEED
-- Hotel Demo POSTY — Colombia — COP
--
-- WARNING: THIS IS DEMO DATA ONLY.
-- Do NOT run in production. For local dev / demo environments only.
-- =============================================================

-- Disable RLS for seed operations
set session_replication_role = replica;

-- =============================================================
-- STEP 1: Organization + catalog defaults
-- =============================================================

do $$
declare
  v_org_id              uuid := gen_random_uuid();
  v_gestor_role_id      uuid;
  v_recep_role_id       uuid;
  v_cam_role_id         uuid;
  v_mant_role_id        uuid;

  -- employee auth UUIDs
  v_gestor_uid          uuid := gen_random_uuid();
  v_recep1_uid          uuid := gen_random_uuid();
  v_recep2_uid          uuid := gen_random_uuid();
  v_cam1_uid            uuid := gen_random_uuid();
  v_cam2_uid            uuid := gen_random_uuid();
  v_mant1_uid           uuid := gen_random_uuid();

  -- catalog IDs resolved after seed_organization_defaults
  v_status_disponible   uuid;
  v_status_ocupada      uuid;
  v_status_sucia        uuid;
  v_status_mant         uuid;

  v_type_estandar       uuid;
  v_type_superior       uuid;
  v_type_suite          uuid;

  v_doc_cc              uuid;
  v_doc_pa              uuid;

  v_channel_directo     uuid;
  v_channel_walkin      uuid;
  v_channel_booking     uuid;

  v_reason_turismo      uuid;
  v_reason_negocios     uuid;

  v_pm_efectivo         uuid;
  v_pm_tarjeta          uuid;
  v_pm_transferencia    uuid;
  v_pm_nequi            uuid;

  v_rc_habitaciones     uuid;
  v_rc_ayb              uuid;
  v_rc_otros            uuid;

  v_cat_hab             uuid;
  v_cat_ayb             uuid;
  v_cat_admin           uuid;
  v_cat_utilities       uuid;
  v_cat_nomina          uuid;
  v_cat_mant_cat        uuid;

  v_ts_por_hacer        uuid;
  v_ts_en_progreso      uuid;
  v_ts_completada       uuid;

  v_guests              uuid[];

  today                 date := current_date;
  prev_month            date := date_trunc('month', current_date) - interval '1 month';
  curr_month            date := date_trunc('month', current_date);

begin

-- -------------------------------------------------------
-- Organization
-- -------------------------------------------------------

insert into public.organizations (
  id, name, tax_id, currency, locale, timezone,
  date_format, default_check_in_time, default_check_out_time, tax_rate
) values (
  v_org_id,
  'Hotel Demo POSTY',
  '900.123.456-7',
  'COP',
  'es-CO',
  'America/Bogota',
  'dd/MM/yyyy',
  '15:00',
  '12:00',
  19.0
);

-- Seed all default catalogs, shift templates, roles
perform public.seed_organization_defaults(v_org_id);

-- -------------------------------------------------------
-- Resolve catalog IDs
-- -------------------------------------------------------

select id into v_status_disponible from public.room_statuses   where organization_id = v_org_id and name = 'Disponible';
select id into v_status_ocupada    from public.room_statuses   where organization_id = v_org_id and name = 'Ocupada';
select id into v_status_sucia      from public.room_statuses   where organization_id = v_org_id and name = 'Sucia';
select id into v_status_mant       from public.room_statuses   where organization_id = v_org_id and name = 'Mantenimiento';

select id into v_doc_cc            from public.document_types  where organization_id = v_org_id and code = 'CC';
select id into v_doc_pa            from public.document_types  where organization_id = v_org_id and code = 'PA';

select id into v_channel_directo   from public.booking_channels where organization_id = v_org_id and name = 'Directo';
select id into v_channel_walkin    from public.booking_channels where organization_id = v_org_id and name = 'Walk-in';
select id into v_channel_booking   from public.booking_channels where organization_id = v_org_id and name = 'Booking';

select id into v_reason_turismo    from public.travel_reasons  where organization_id = v_org_id and name = 'Turismo';
select id into v_reason_negocios   from public.travel_reasons  where organization_id = v_org_id and name = 'Negocios';

select id into v_pm_efectivo       from public.payment_methods where organization_id = v_org_id and name = 'Efectivo';
select id into v_pm_tarjeta        from public.payment_methods where organization_id = v_org_id and name = 'Tarjeta débito';
select id into v_pm_transferencia  from public.payment_methods where organization_id = v_org_id and name = 'Transferencia';
select id into v_pm_nequi          from public.payment_methods where organization_id = v_org_id and name = 'Nequi';

select id into v_rc_habitaciones   from public.revenue_centers  where organization_id = v_org_id and name = 'Habitaciones';
select id into v_rc_ayb            from public.revenue_centers  where organization_id = v_org_id and name = 'Alimentos y Bebidas';
select id into v_rc_otros          from public.revenue_centers  where organization_id = v_org_id and name = 'Otros';

select id into v_cat_hab           from public.expense_categories where organization_id = v_org_id and name = 'Costo de habitaciones';
select id into v_cat_ayb           from public.expense_categories where organization_id = v_org_id and name = 'Costo de A&B';
select id into v_cat_admin         from public.expense_categories where organization_id = v_org_id and name = 'Administración';
select id into v_cat_utilities     from public.expense_categories where organization_id = v_org_id and name = 'Servicios públicos';
select id into v_cat_nomina        from public.expense_categories where organization_id = v_org_id and name = 'Nómina';
select id into v_cat_mant_cat      from public.expense_categories where organization_id = v_org_id and name = 'Mantenimiento';

select id into v_ts_por_hacer      from public.task_statuses where organization_id = v_org_id and name = 'Por hacer';
select id into v_ts_en_progreso    from public.task_statuses where organization_id = v_org_id and name = 'En progreso';
select id into v_ts_completada     from public.task_statuses where organization_id = v_org_id and name = 'Completada';

select id into v_gestor_role_id    from public.roles where organization_id = v_org_id and name = 'Gestor';
select id into v_recep_role_id     from public.roles where organization_id = v_org_id and name = 'Recepcionista';
select id into v_cam_role_id       from public.roles where organization_id = v_org_id and name = 'Camarera de piso';
select id into v_mant_role_id      from public.roles where organization_id = v_org_id and name = 'Mantenimiento';

-- =============================================================
-- STEP 2: Room types
-- =============================================================

insert into public.room_types (id, organization_id, name, description, base_rate, max_adults, max_children, amenities) values
  (gen_random_uuid(), v_org_id, 'Estándar', 'Habitación estándar cómoda', 150000, 2, 1,
    array['WiFi gratuito','TV pantalla plana','Aire acondicionado','Baño privado']),
  (gen_random_uuid(), v_org_id, 'Superior', 'Habitación superior con vista panorámica', 210000, 2, 2,
    array['WiFi gratuito','TV pantalla plana','Aire acondicionado','Balcón','Vista al jardín']),
  (gen_random_uuid(), v_org_id, 'Suite',    'Suite de lujo con todas las comodidades', 350000, 3, 2,
    array['WiFi gratuito','TV 55"','Aire acondicionado','Balcón privado','Bañera jacuzzi','Minibar','Sala de estar']);

select id into v_type_estandar from public.room_types where organization_id = v_org_id and name = 'Estándar';
select id into v_type_superior from public.room_types where organization_id = v_org_id and name = 'Superior';
select id into v_type_suite    from public.room_types where organization_id = v_org_id and name = 'Suite';

-- =============================================================
-- STEP 3: 24 Rooms — 3 floors × 8 rooms
-- =============================================================

-- Piso 1: 5 Estándar + 2 Superior + 1 Suite
insert into public.rooms (organization_id, number, floor, room_type_id, status_id, housekeeping_status) values
  (v_org_id, '101', '1', v_type_estandar, v_status_disponible, 'clean'),
  (v_org_id, '102', '1', v_type_estandar, v_status_disponible, 'clean'),
  (v_org_id, '103', '1', v_type_estandar, v_status_ocupada,    'dirty'),
  (v_org_id, '104', '1', v_type_estandar, v_status_ocupada,    'dirty'),
  (v_org_id, '105', '1', v_type_estandar, v_status_sucia,      'dirty'),
  (v_org_id, '106', '1', v_type_superior, v_status_disponible, 'clean'),
  (v_org_id, '107', '1', v_type_superior, v_status_ocupada,    'dirty'),
  (v_org_id, '108', '1', v_type_suite,    v_status_mant,       'clean');

-- Piso 2: 4 Estándar + 3 Superior + 1 Suite
insert into public.rooms (organization_id, number, floor, room_type_id, status_id, housekeeping_status) values
  (v_org_id, '201', '2', v_type_estandar, v_status_disponible, 'clean'),
  (v_org_id, '202', '2', v_type_estandar, v_status_ocupada,    'dirty'),
  (v_org_id, '203', '2', v_type_estandar, v_status_ocupada,    'dirty'),
  (v_org_id, '204', '2', v_type_estandar, v_status_disponible, 'clean'),
  (v_org_id, '205', '2', v_type_superior, v_status_ocupada,    'dirty'),
  (v_org_id, '206', '2', v_type_superior, v_status_disponible, 'clean'),
  (v_org_id, '207', '2', v_type_superior, v_status_sucia,      'dirty'),
  (v_org_id, '208', '2', v_type_suite,    v_status_ocupada,    'dirty');

-- Piso 3: 3 Estándar + 3 Superior + 2 Suite
insert into public.rooms (organization_id, number, floor, room_type_id, status_id, housekeeping_status) values
  (v_org_id, '301', '3', v_type_estandar, v_status_disponible, 'clean'),
  (v_org_id, '302', '3', v_type_estandar, v_status_disponible, 'clean'),
  (v_org_id, '303', '3', v_type_estandar, v_status_ocupada,    'dirty'),
  (v_org_id, '304', '3', v_type_superior, v_status_ocupada,    'dirty'),
  (v_org_id, '305', '3', v_type_superior, v_status_disponible, 'clean'),
  (v_org_id, '306', '3', v_type_superior, v_status_sucia,      'dirty'),
  (v_org_id, '307', '3', v_type_suite,    v_status_disponible, 'clean'),
  (v_org_id, '308', '3', v_type_suite,    v_status_ocupada,    'dirty');

-- =============================================================
-- STEP 4: Auth users + Profiles (6 employees)
-- NOTE: For demo/local use only. Passwords: Demo1234!
-- =============================================================

insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
) values
  (v_gestor_uid, '00000000-0000-0000-0000-000000000000', 'gestor@hoteldemo.co',
    crypt('Demo1234!', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  (v_recep1_uid, '00000000-0000-0000-0000-000000000000', 'recep1@hoteldemo.co',
    crypt('Demo1234!', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  (v_recep2_uid, '00000000-0000-0000-0000-000000000000', 'recep2@hoteldemo.co',
    crypt('Demo1234!', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  (v_cam1_uid,   '00000000-0000-0000-0000-000000000000', 'cam1@hoteldemo.co',
    crypt('Demo1234!', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  (v_cam2_uid,   '00000000-0000-0000-0000-000000000000', 'cam2@hoteldemo.co',
    crypt('Demo1234!', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  (v_mant1_uid,  '00000000-0000-0000-0000-000000000000', 'mant1@hoteldemo.co',
    crypt('Demo1234!', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated');

insert into public.profiles (id, organization_id, role_id, full_name, email, phone, job_title, hire_date, is_active) values
  (v_gestor_uid, v_org_id, v_gestor_role_id, 'Carlos Ramírez',  'gestor@hoteldemo.co', '+573001234567', 'Gerente General',       today - 730, true),
  (v_recep1_uid, v_org_id, v_recep_role_id,  'Laura Torres',    'recep1@hoteldemo.co', '+573009876543', 'Recepcionista',         today - 365, true),
  (v_recep2_uid, v_org_id, v_recep_role_id,  'Andrés Gómez',    'recep2@hoteldemo.co', '+573005551234', 'Recepcionista',         today - 180, true),
  (v_cam1_uid,   v_org_id, v_cam_role_id,    'María González',  'cam1@hoteldemo.co',   '+573004445678', 'Camarera de Piso',      today - 500, true),
  (v_cam2_uid,   v_org_id, v_cam_role_id,    'Claudia Herrera', 'cam2@hoteldemo.co',   '+573003334567', 'Camarera de Piso',      today - 200, true),
  (v_mant1_uid,  v_org_id, v_mant_role_id,   'Jorge Morales',   'mant1@hoteldemo.co',  '+573002223456', 'Técnico Mantenimiento', today - 400, true);

-- =============================================================
-- STEP 5: Work schedules (weekday 0=Monday…6=Sunday)
-- =============================================================

-- Carlos (Gestor): Lun–Vie 08:00–17:00
insert into public.work_schedules (profile_id, weekday, start_time, end_time, is_day_off) values
  (v_gestor_uid,0,'08:00','17:00',false),(v_gestor_uid,1,'08:00','17:00',false),
  (v_gestor_uid,2,'08:00','17:00',false),(v_gestor_uid,3,'08:00','17:00',false),
  (v_gestor_uid,4,'08:00','17:00',false),(v_gestor_uid,5,'00:00','00:00',true),
  (v_gestor_uid,6,'00:00','00:00',true);

-- Laura (Recep1): Lun–Sáb 07:00–15:00
insert into public.work_schedules (profile_id, weekday, start_time, end_time, is_day_off) values
  (v_recep1_uid,0,'07:00','15:00',false),(v_recep1_uid,1,'07:00','15:00',false),
  (v_recep1_uid,2,'07:00','15:00',false),(v_recep1_uid,3,'07:00','15:00',false),
  (v_recep1_uid,4,'07:00','15:00',false),(v_recep1_uid,5,'07:00','15:00',false),
  (v_recep1_uid,6,'00:00','00:00',true);

-- Andrés (Recep2): Mar–Dom 15:00–23:00
insert into public.work_schedules (profile_id, weekday, start_time, end_time, is_day_off) values
  (v_recep2_uid,0,'00:00','00:00',true),(v_recep2_uid,1,'15:00','23:00',false),
  (v_recep2_uid,2,'15:00','23:00',false),(v_recep2_uid,3,'15:00','23:00',false),
  (v_recep2_uid,4,'15:00','23:00',false),(v_recep2_uid,5,'15:00','23:00',false),
  (v_recep2_uid,6,'15:00','23:00',false);

-- María (Cam1): Lun–Vie 08:00–16:00
insert into public.work_schedules (profile_id, weekday, start_time, end_time, is_day_off) values
  (v_cam1_uid,0,'08:00','16:00',false),(v_cam1_uid,1,'08:00','16:00',false),
  (v_cam1_uid,2,'08:00','16:00',false),(v_cam1_uid,3,'08:00','16:00',false),
  (v_cam1_uid,4,'08:00','16:00',false),(v_cam1_uid,5,'00:00','00:00',true),
  (v_cam1_uid,6,'00:00','00:00',true);

-- Claudia (Cam2): Mié–Dom 08:00–16:00
insert into public.work_schedules (profile_id, weekday, start_time, end_time, is_day_off) values
  (v_cam2_uid,0,'00:00','00:00',true),(v_cam2_uid,1,'00:00','00:00',true),
  (v_cam2_uid,2,'08:00','16:00',false),(v_cam2_uid,3,'08:00','16:00',false),
  (v_cam2_uid,4,'08:00','16:00',false),(v_cam2_uid,5,'08:00','16:00',false),
  (v_cam2_uid,6,'08:00','16:00',false);

-- Jorge (Mant): Lun–Vie 07:00–15:00
insert into public.work_schedules (profile_id, weekday, start_time, end_time, is_day_off) values
  (v_mant1_uid,0,'07:00','15:00',false),(v_mant1_uid,1,'07:00','15:00',false),
  (v_mant1_uid,2,'07:00','15:00',false),(v_mant1_uid,3,'07:00','15:00',false),
  (v_mant1_uid,4,'07:00','15:00',false),(v_mant1_uid,5,'00:00','00:00',true),
  (v_mant1_uid,6,'00:00','00:00',true);

-- =============================================================
-- STEP 6: Time off
-- =============================================================

insert into public.time_off (profile_id, start_date, end_date, type, note) values
  (v_recep1_uid, today + 7,  today + 14, 'vacation', 'Vacaciones programadas'),
  (v_mant1_uid,  today - 5,  today - 2,  'sick',     'Incapacidad médica');

-- =============================================================
-- STEP 7: 30 Guests (Colombians + 2 international)
-- =============================================================

with g as (
  insert into public.guests (
    id, organization_id, first_name, last_name,
    document_type_id, document_number, nationality, phone, email,
    city_of_origin, country_of_origin
  ) values
    (gen_random_uuid(),v_org_id,'Sofía',    'Martínez',  v_doc_cc,'1098765432','Colombiana', '+573001112233','sofia.m@correo.co',    'Medellín',      'Colombia'),
    (gen_random_uuid(),v_org_id,'Daniel',   'López',     v_doc_cc,'1023456789','Colombiano', '+573002223344','daniel.l@correo.co',   'Bogotá',        'Colombia'),
    (gen_random_uuid(),v_org_id,'Valentina','Rodríguez', v_doc_cc,'1056789012','Colombiana', '+573003334455','valen.r@correo.co',    'Cali',          'Colombia'),
    (gen_random_uuid(),v_org_id,'Miguel',   'Hernández', v_doc_cc,'1089012345','Colombiano', '+573004445566','miguel.h@correo.co',   'Barranquilla',  'Colombia'),
    (gen_random_uuid(),v_org_id,'Isabella', 'García',    v_doc_cc,'1012345678','Colombiana', '+573005556677','isabella.g@correo.co', 'Pereira',       'Colombia'),
    (gen_random_uuid(),v_org_id,'Sebastián','Jiménez',   v_doc_cc,'1045678901','Colombiano', '+573006667788','sebas.j@correo.co',    'Manizales',     'Colombia'),
    (gen_random_uuid(),v_org_id,'Camila',   'Vargas',    v_doc_cc,'1078901234','Colombiana', '+573007778899','camila.v@correo.co',   'Bucaramanga',   'Colombia'),
    (gen_random_uuid(),v_org_id,'Santiago', 'Pérez',     v_doc_cc,'1001234567','Colombiano', '+573008889900','santi.p@correo.co',    'Cartagena',     'Colombia'),
    (gen_random_uuid(),v_org_id,'Mariana',  'Díaz',      v_doc_cc,'1034567890','Colombiana', '+573009990011','mariana.d@correo.co',  'Santa Marta',   'Colombia'),
    (gen_random_uuid(),v_org_id,'Alejandro','Torres',    v_doc_cc,'1067890123','Colombiano', '+573000001122','ale.t@correo.co',      'Ibagué',        'Colombia'),
    (gen_random_uuid(),v_org_id,'Luisa',    'Morales',   v_doc_cc,'1090123456','Colombiana', '+573001234123','luisa.m@correo.co',    'Cúcuta',        'Colombia'),
    (gen_random_uuid(),v_org_id,'Felipe',   'Castro',    v_doc_cc,'1023456000','Colombiano', '+573002345234','felipe.c@correo.co',   'Villavicencio', 'Colombia'),
    (gen_random_uuid(),v_org_id,'Natalia',  'Reyes',     v_doc_cc,'1056780001','Colombiana', '+573003456345','natalia.r@correo.co',  'Pasto',         'Colombia'),
    (gen_random_uuid(),v_org_id,'Tomás',    'Mendoza',   v_doc_cc,'1089010002','Colombiano', '+573004567456','tomas.m@correo.co',    'Montería',      'Colombia'),
    (gen_random_uuid(),v_org_id,'Juliana',  'Ramos',     v_doc_cc,'1012340003','Colombiana', '+573005678567','juliana.r@correo.co',  'Sincelejo',     'Colombia'),
    (gen_random_uuid(),v_org_id,'Mateo',    'Flores',    v_doc_cc,'1045670004','Colombiano', '+573006789678','mateo.f@correo.co',    'Valledupar',    'Colombia'),
    (gen_random_uuid(),v_org_id,'Daniela',  'Sánchez',   v_doc_cc,'1078900005','Colombiana', '+573007890789','dani.s@correo.co',     'Neiva',         'Colombia'),
    (gen_random_uuid(),v_org_id,'Nicolás',  'Gutiérrez', v_doc_cc,'1001230006','Colombiano', '+573008901890','nico.g@correo.co',     'Armenia',       'Colombia'),
    (gen_random_uuid(),v_org_id,'Sara',     'Ortiz',     v_doc_cc,'1034560007','Colombiana', '+573009012901','sara.o@correo.co',     'Popayán',       'Colombia'),
    (gen_random_uuid(),v_org_id,'Emilio',   'Navarro',   v_doc_cc,'1067890008','Colombiano', '+573000123012','emilio.n@correo.co',   'Tunja',         'Colombia'),
    (gen_random_uuid(),v_org_id,'Victoria', 'Ruiz',      v_doc_cc,'1090120009','Colombiana', '+573001234234','vicky.r@correo.co',    'Bogotá',        'Colombia'),
    (gen_random_uuid(),v_org_id,'Andrés',   'Molina',    v_doc_cc,'1023450010','Colombiano', '+573002345345','andres.m@correo.co',   'Medellín',      'Colombia'),
    (gen_random_uuid(),v_org_id,'Paula',    'Aguilar',   v_doc_cc,'1056780011','Colombiana', '+573003456456','paula.a@correo.co',    'Cali',          'Colombia'),
    (gen_random_uuid(),v_org_id,'Diego',    'Fuentes',   v_doc_cc,'1089010012','Colombiano', '+573004567567','diego.f@correo.co',    'Barranquilla',  'Colombia'),
    (gen_random_uuid(),v_org_id,'Elena',    'Silva',     v_doc_cc,'1012340013','Colombiana', '+573005678678','elena.s@correo.co',    'Cartagena',     'Colombia'),
    (gen_random_uuid(),v_org_id,'Ricardo',  'Vega',      v_doc_cc,'1045670014','Colombiano', '+573006789789','ricardo.v@correo.co',  'Bogotá',        'Colombia'),
    (gen_random_uuid(),v_org_id,'Carmen',   'Ibáñez',    v_doc_cc,'1078900015','Colombiana', '+573007890890','carmen.i@correo.co',   'Medellín',      'Colombia'),
    (gen_random_uuid(),v_org_id,'Roberto',  'Blanco',    v_doc_pa,'US987654321','Estadounidense','+573008901901','rob.b@correo.co','New York',       'USA'),
    (gen_random_uuid(),v_org_id,'Julia',    'Smith',     v_doc_pa,'GB123456789','Británica',  '+573009012012','julia.s@correo.co',   'London',        'United Kingdom'),
    (gen_random_uuid(),v_org_id,'Luis',     'Orozco',    v_doc_cc,'1001230016','Colombiano', '+573000123123','luis.o@correo.co',     'Pereira',       'Colombia')
  returning id
)
select array_agg(id order by id) into v_guests from g;

-- =============================================================
-- STEP 8: Stays — avoid double-booking constraint using
-- non-overlapping date ranges per room.
-- 10 checked_out (past) + 10 checked_in (current) + 10 reserved (future)
-- =============================================================

-- --- 10 checked_out stays (past month) ---
insert into public.stays (
  organization_id, room_id, primary_guest_id,
  check_in_date, check_out_date, adults, status,
  channel_id, travel_reason_id, rate_per_night, currency,
  actual_check_in_at, actual_check_out_at, created_by
) values
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='101'),v_guests[1],  prev_month+1,  prev_month+3,  2,'checked_out',v_channel_directo, v_reason_turismo, 150000,'COP', (prev_month+1)::timestamptz+interval'15h', (prev_month+3)::timestamptz+interval'12h', v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='102'),v_guests[2],  prev_month+3,  prev_month+6,  1,'checked_out',v_channel_walkin,  v_reason_negocios,150000,'COP', (prev_month+3)::timestamptz+interval'16h', (prev_month+6)::timestamptz+interval'12h', v_recep2_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='106'),v_guests[3],  prev_month+2,  prev_month+5,  2,'checked_out',v_channel_booking, v_reason_turismo, 210000,'COP', (prev_month+2)::timestamptz+interval'14h', (prev_month+5)::timestamptz+interval'12h', v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='201'),v_guests[4],  prev_month+5,  prev_month+8,  1,'checked_out',v_channel_directo, v_reason_negocios,150000,'COP', (prev_month+5)::timestamptz+interval'15h', (prev_month+8)::timestamptz+interval'12h', v_recep2_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='204'),v_guests[5],  prev_month+7,  prev_month+10, 2,'checked_out',v_channel_walkin,  v_reason_turismo, 150000,'COP', (prev_month+7)::timestamptz+interval'16h', (prev_month+10)::timestamptz+interval'12h',v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='206'),v_guests[6],  prev_month+4,  prev_month+7,  2,'checked_out',v_channel_booking, v_reason_turismo, 210000,'COP', (prev_month+4)::timestamptz+interval'15h', (prev_month+7)::timestamptz+interval'12h', v_gestor_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='301'),v_guests[7],  prev_month+10, prev_month+13, 3,'checked_out',v_channel_directo, v_reason_turismo, 150000,'COP', (prev_month+10)::timestamptz+interval'15h',(prev_month+13)::timestamptz+interval'12h',v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='302'),v_guests[8],  prev_month+12, prev_month+15, 2,'checked_out',v_channel_booking, v_reason_negocios,150000,'COP', (prev_month+12)::timestamptz+interval'14h',(prev_month+15)::timestamptz+interval'12h',v_recep2_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='305'),v_guests[9],  prev_month+8,  prev_month+11, 1,'checked_out',v_channel_walkin,  v_reason_turismo, 210000,'COP', (prev_month+8)::timestamptz+interval'15h', (prev_month+11)::timestamptz+interval'12h',v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='307'),v_guests[10], prev_month+6,  prev_month+10, 2,'checked_out',v_channel_directo, v_reason_turismo, 350000,'COP', (prev_month+6)::timestamptz+interval'16h', (prev_month+10)::timestamptz+interval'12h',v_gestor_uid);

-- --- 10 checked_in stays (active now) ---
insert into public.stays (
  organization_id, room_id, primary_guest_id,
  check_in_date, check_out_date, adults, status,
  channel_id, travel_reason_id, rate_per_night, currency,
  actual_check_in_at, created_by
) values
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='103'),v_guests[11], today-2, today+2, 2,'checked_in',v_channel_directo, v_reason_turismo, 150000,'COP',(today-2)::timestamptz+interval'15h',v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='104'),v_guests[12], today-1, today+3, 1,'checked_in',v_channel_walkin,  v_reason_negocios,150000,'COP',(today-1)::timestamptz+interval'16h',v_recep2_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='107'),v_guests[13], today-1, today+2, 2,'checked_in',v_channel_booking, v_reason_turismo, 210000,'COP',(today-1)::timestamptz+interval'15h',v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='202'),v_guests[14], today,   today+4, 2,'checked_in',v_channel_directo, v_reason_turismo, 150000,'COP', today::timestamptz+interval'15h',   v_recep2_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='203'),v_guests[15], today-3, today+1, 1,'checked_in',v_channel_walkin,  v_reason_negocios,150000,'COP',(today-3)::timestamptz+interval'14h',v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='205'),v_guests[16], today-1, today+3, 3,'checked_in',v_channel_booking, v_reason_turismo, 210000,'COP',(today-1)::timestamptz+interval'16h',v_recep2_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='208'),v_guests[17], today-2, today+3, 2,'checked_in',v_channel_directo, v_reason_negocios,350000,'COP',(today-2)::timestamptz+interval'17h',v_gestor_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='303'),v_guests[18], today-1, today+4, 2,'checked_in',v_channel_directo, v_reason_turismo, 150000,'COP',(today-1)::timestamptz+interval'15h',v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='304'),v_guests[19], today,   today+5, 1,'checked_in',v_channel_walkin,  v_reason_negocios,210000,'COP', today::timestamptz+interval'14h',   v_recep2_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='308'),v_guests[20], today-1, today+4, 4,'checked_in',v_channel_booking, v_reason_turismo, 350000,'COP',(today-1)::timestamptz+interval'16h',v_gestor_uid);

-- --- 10 reserved stays (future) ---
insert into public.stays (
  organization_id, room_id, primary_guest_id,
  check_in_date, check_out_date, adults, status,
  channel_id, travel_reason_id, rate_per_night, currency, created_by
) values
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='101'),v_guests[21], today+5, today+8,  2,'reserved',v_channel_directo, v_reason_turismo, 150000,'COP',v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='102'),v_guests[22], today+3, today+6,  1,'reserved',v_channel_booking, v_reason_negocios,150000,'COP',v_recep2_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='106'),v_guests[23], today+7, today+10, 2,'reserved',v_channel_directo, v_reason_turismo, 210000,'COP',v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='201'),v_guests[24], today+2, today+5,  2,'reserved',v_channel_walkin,  v_reason_turismo, 150000,'COP',v_recep2_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='204'),v_guests[25], today+4, today+8,  1,'reserved',v_channel_booking, v_reason_negocios,150000,'COP',v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='206'),v_guests[26], today+6, today+9,  2,'reserved',v_channel_directo, v_reason_turismo, 210000,'COP',v_gestor_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='301'),v_guests[27], today+1, today+4,  3,'reserved',v_channel_booking, v_reason_turismo, 150000,'COP',v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='302'),v_guests[28], today+8, today+11, 2,'reserved',v_channel_directo, v_reason_negocios,150000,'COP',v_recep2_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='305'),v_guests[29], today+3, today+7,  1,'reserved',v_channel_walkin,  v_reason_turismo, 210000,'COP',v_recep1_uid),
  (v_org_id,(select id from public.rooms where organization_id=v_org_id and number='307'),v_guests[30], today+10,today+14, 2,'reserved',v_channel_booking, v_reason_turismo, 350000,'COP',v_gestor_uid);

-- =============================================================
-- STEP 9: Folio charges + payments for checked_out stays
-- =============================================================

-- Room charges for all checked_out stays
insert into public.folio_charges (stay_id, revenue_center_id, description, quantity, unit_price, tax_rate, posted_by)
select s.id, v_rc_habitaciones,
  'Cargo noche habitación',
  s.nights,
  s.rate_per_night,
  0,
  v_recep1_uid
from public.stays s
where s.organization_id = v_org_id
  and s.status = 'checked_out';

-- A&B charges for stays ≥ 2 nights
insert into public.folio_charges (stay_id, revenue_center_id, description, quantity, unit_price, tax_rate, posted_by)
select s.id, v_rc_ayb,
  'Desayuno incluido',
  s.nights,
  28000,
  0,
  v_recep1_uid
from public.stays s
where s.organization_id = v_org_id
  and s.status = 'checked_out'
  and s.nights >= 2;

-- Payments for checked_out stays (full settlement)
insert into public.payments (stay_id, method_id, amount, paid_at, reference, created_by)
select
  s.id,
  case (row_number() over (order by s.id) % 4)::int
    when 0 then v_pm_transferencia
    when 1 then v_pm_efectivo
    when 2 then v_pm_tarjeta
    else v_pm_nequi
  end,
  coalesce(fc.total, s.nights * s.rate_per_night),
  s.check_out_date::timestamptz + interval '12 hours',
  'REF-' || upper(substr(md5(random()::text), 1, 8)),
  v_recep1_uid
from public.stays s
left join (
  select stay_id, sum(total) as total
  from public.folio_charges
  group by stay_id
) fc on fc.stay_id = s.id
where s.organization_id = v_org_id
  and s.status = 'checked_out';

-- Partial room charges for checked_in stays (nights so far)
insert into public.folio_charges (stay_id, revenue_center_id, description, quantity, unit_price, tax_rate, posted_by)
select
  s.id,
  v_rc_habitaciones,
  'Cargo parcial habitación',
  greatest(today - s.check_in_date, 1),
  s.rate_per_night,
  0,
  v_recep1_uid
from public.stays s
where s.organization_id = v_org_id
  and s.status = 'checked_in'
  and today > s.check_in_date;

-- =============================================================
-- STEP 10: Expenses — current month + previous month
-- =============================================================

insert into public.expenses (organization_id, category_id, supplier, description, amount, tax_amount, expense_date, payment_status, created_by)
values
  -- Current month
  (v_org_id, v_cat_nomina,    'Recursos Humanos', 'Nómina empleados',              4800000, 0,      curr_month+5,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_utilities, 'EPM',              'Electricidad',                    395000, 75050,  curr_month+3,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_utilities, 'Acueducto',        'Agua y alcantarillado',           152000, 28880,  curr_month+3,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_admin,     'Papelería Presto',  'Suministros oficina',             88000, 16720,  curr_month+8,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_mant_cat,  'Ferretería N.',    'Repuestos mantenimiento AC',      235000, 44650,  curr_month+10, 'paid',    v_gestor_uid),
  (v_org_id, v_cat_ayb,       'Dist. Alimentos',  'Insumos desayunos y bar',         378000, 71820,  curr_month+7,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_hab,       'Lavandería Total', 'Servicio lencería',               295000, 56050,  curr_month+9,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_utilities, 'Claro',            'Internet y telefonía',            198000, 37620,  curr_month+5,  'pending', v_gestor_uid),
  (v_org_id, v_cat_mant_cat,  'Homecenter',       'Materiales pintura',              480000, 91200,  curr_month+15, 'pending', v_gestor_uid),
  (v_org_id, v_cat_admin,     'Banco Colombia',   'Comisiones bancarias',             48000, 0,      curr_month+1,  'paid',    v_gestor_uid),
  -- Previous month
  (v_org_id, v_cat_nomina,    'Recursos Humanos', 'Nómina empleados mes anterior',  4800000, 0,      prev_month+5,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_utilities, 'EPM',              'Electricidad mes anterior',        370000, 70300,  prev_month+3,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_utilities, 'Acueducto',        'Agua mes anterior',               140000, 26600,  prev_month+3,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_admin,     'Papelería Presto',  'Suministros mes anterior',         75000, 14250,  prev_month+8,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_mant_cat,  'Grupo Eléctrico', 'Mant. tablero eléctrico',          390000, 74100,  prev_month+12, 'paid',    v_gestor_uid),
  (v_org_id, v_cat_ayb,       'Dist. Alimentos', 'Insumos mes anterior',             325000, 61750,  prev_month+7,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_hab,       'Lavandería Total', 'Lencería mes anterior',            270000, 51300,  prev_month+9,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_utilities, 'Claro',            'Internet mes anterior',            198000, 37620,  prev_month+5,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_admin,     'Banco Colombia',   'Comisiones mes anterior',           44000, 0,      prev_month+1,  'paid',    v_gestor_uid),
  (v_org_id, v_cat_mant_cat,  'Ferretería N.',   'Bomba piscina',                    520000, 98800,  prev_month+20, 'paid',    v_gestor_uid);

-- =============================================================
-- STEP 11: Other revenue
-- =============================================================

insert into public.other_revenue (organization_id, revenue_center_id, description, amount, tax_amount, revenue_date, created_by)
values
  (v_org_id, v_rc_ayb,   'Sala de reuniones — evento corporativo', 680000, 129200, curr_month+2,  v_gestor_uid),
  (v_org_id, v_rc_ayb,   'Bar — fin de semana',                   430000,  81700, curr_month+4,  v_recep1_uid),
  (v_org_id, v_rc_otros, 'Parqueadero visitantes',                  90000,  17100, curr_month+3,  v_recep2_uid),
  (v_org_id, v_rc_ayb,   'Desayunos extras',                       195000,  37050, curr_month+6,  v_recep1_uid),
  (v_org_id, v_rc_otros, 'Lavandería huéspedes',                    98000,  18620, curr_month+8,  v_recep2_uid),
  (v_org_id, v_rc_ayb,   'Evento corporativo cena',               880000, 167200, prev_month+15, v_gestor_uid),
  (v_org_id, v_rc_ayb,   'Bar — fines de semana mes ant.',         575000, 109250, prev_month+22, v_recep1_uid),
  (v_org_id, v_rc_otros, 'Parqueadero mes anterior',                76000,  14440, prev_month+10, v_recep2_uid);

-- =============================================================
-- STEP 12: Monthly budgets (current year)
-- =============================================================

insert into public.budgets (organization_id, year, month, metric_key, amount)
select v_org_id, extract(year from current_date)::int, m, k, v
from (values
  (1,'revenue_total',8200000),(1,'gop',3600000),(1,'occupancy',55),(1,'adr',175000),
  (2,'revenue_total',8600000),(2,'gop',3800000),(2,'occupancy',58),(2,'adr',178000),
  (3,'revenue_total',9600000),(3,'gop',4300000),(3,'occupancy',66),(3,'adr',182000),
  (4,'revenue_total',9100000),(4,'gop',4000000),(4,'occupancy',62),(4,'adr',180000),
  (5,'revenue_total',8900000),(5,'gop',3900000),(5,'occupancy',61),(5,'adr',180000),
  (6,'revenue_total',8300000),(6,'gop',3600000),(6,'occupancy',57),(6,'adr',176000),
  (7,'revenue_total',7900000),(7,'gop',3400000),(7,'occupancy',54),(7,'adr',174000),
  (8,'revenue_total',8100000),(8,'gop',3500000),(8,'occupancy',56),(8,'adr',175000),
  (9,'revenue_total',8800000),(9,'gop',3900000),(9,'occupancy',61),(9,'adr',179000),
  (10,'revenue_total',9400000),(10,'gop',4200000),(10,'occupancy',64),(10,'adr',181000),
  (11,'revenue_total',9900000),(11,'gop',4500000),(11,'occupancy',68),(11,'adr',184000),
  (12,'revenue_total',10800000),(12,'gop',4800000),(12,'occupancy',73),(12,'adr',188000)
) as t(m,k,v);

-- =============================================================
-- STEP 13: Tasks (40 tasks spread across employees)
-- =============================================================

insert into public.tasks (
  id, organization_id, title, description, status_id, priority,
  created_by, due_date, room_id
) values
  -- Limpieza (camareras) — TODAY
  (gen_random_uuid(),v_org_id,'Limpiar hab. 103','Limpieza profunda post check-out', v_ts_en_progreso,'high',   v_cam1_uid, today,   (select id from public.rooms where organization_id=v_org_id and number='103')),
  (gen_random_uuid(),v_org_id,'Limpiar hab. 104','Cambio sábanas y toallas',         v_ts_por_hacer,  'medium', v_cam1_uid, today,   (select id from public.rooms where organization_id=v_org_id and number='104')),
  (gen_random_uuid(),v_org_id,'Limpiar hab. 107','Amenities y revisión minibar',     v_ts_por_hacer,  'medium', v_cam2_uid, today,   (select id from public.rooms where organization_id=v_org_id and number='107')),
  (gen_random_uuid(),v_org_id,'Limpiar hab. 105','Limpieza estándar',                v_ts_completada, 'medium', v_cam1_uid, today,   (select id from public.rooms where organization_id=v_org_id and number='105')),
  (gen_random_uuid(),v_org_id,'Limpiar hab. 202','Limpieza diaria check-in',         v_ts_completada, 'low',    v_cam1_uid, today,   (select id from public.rooms where organization_id=v_org_id and number='202')),
  (gen_random_uuid(),v_org_id,'Limpiar hab. 207','Limpieza completa',                v_ts_por_hacer,  'medium', v_cam2_uid, today,   (select id from public.rooms where organization_id=v_org_id and number='207')),
  (gen_random_uuid(),v_org_id,'Limpiar hab. 203','Cambio completo lencería',         v_ts_por_hacer,  'medium', v_cam2_uid, today,   (select id from public.rooms where organization_id=v_org_id and number='203')),
  (gen_random_uuid(),v_org_id,'Limpiar hab. 303','Limpieza diaria',                  v_ts_completada, 'low',    v_cam2_uid, today,   (select id from public.rooms where organization_id=v_org_id and number='303')),
  (gen_random_uuid(),v_org_id,'Limpiar hab. 304','Amenities y baño',                 v_ts_completada, 'low',    v_cam1_uid, today,   (select id from public.rooms where organization_id=v_org_id and number='304')),
  (gen_random_uuid(),v_org_id,'Limpiar hab. 306','Limpieza post check-out',          v_ts_en_progreso,'high',   v_cam1_uid, today,   (select id from public.rooms where organization_id=v_org_id and number='306')),
  -- Mantenimiento
  (gen_random_uuid(),v_org_id,'Reparar AC hab. 108','AC no enfría — fuera de servicio',v_ts_en_progreso,'urgent',v_mant1_uid,today,  (select id from public.rooms where organization_id=v_org_id and number='108')),
  (gen_random_uuid(),v_org_id,'Grifo con fuga 205','Llave agua caliente defectuosa', v_ts_por_hacer,  'high',   v_mant1_uid,today,   (select id from public.rooms where organization_id=v_org_id and number='205')),
  (gen_random_uuid(),v_org_id,'Revisión eléctrica piso 3','Rev. preventiva tablero', v_ts_por_hacer,  'medium', v_mant1_uid,today+2, null),
  (gen_random_uuid(),v_org_id,'Retoque pintura pasillo 2','Pintura paredes pasillo', v_ts_por_hacer,  'low',    v_mant1_uid,today+5, null),
  (gen_random_uuid(),v_org_id,'Bombilla quemada 301','Baño principal',               v_ts_completada, 'low',    v_mant1_uid,today,   (select id from public.rooms where organization_id=v_org_id and number='301')),
  (gen_random_uuid(),v_org_id,'Cerradura difícil 208','Ajustar cerradura suite',     v_ts_completada, 'medium', v_mant1_uid,today-1, (select id from public.rooms where organization_id=v_org_id and number='208')),
  (gen_random_uuid(),v_org_id,'Mantenimiento piscina','Limpieza y química del agua', v_ts_por_hacer,  'medium', v_mant1_uid,today+1, null),
  (gen_random_uuid(),v_org_id,'Revisión ascensor','Mantenimiento mensual',           v_ts_por_hacer,  'high',   v_mant1_uid,today+3, null),
  -- Recepción
  (gen_random_uuid(),v_org_id,'Preparar llegadas del día','Revisar reservas y asignar',v_ts_completada,'high',  v_recep1_uid,today,  null),
  (gen_random_uuid(),v_org_id,'Confirmar reservas mañana','Llamar a huéspedes',       v_ts_por_hacer, 'medium', v_recep1_uid,today,  null),
  (gen_random_uuid(),v_org_id,'Actualizar tarifas OTAs','Tarifas semana siguiente',   v_ts_por_hacer, 'medium', v_recep2_uid,today+1,null),
  (gen_random_uuid(),v_org_id,'Reporte ocupación semanal','Informe para gerencia',    v_ts_completada,'medium', v_recep1_uid,today-1,null),
  (gen_random_uuid(),v_org_id,'Responder reseñas Booking','Responder comentarios',    v_ts_por_hacer, 'low',    v_recep2_uid,today+2,null),
  (gen_random_uuid(),v_org_id,'Cuadre de caja turno','Cuadre turno mañana',           v_ts_completada,'high',   v_recep1_uid,today,  null),
  -- Administración (gestor)
  (gen_random_uuid(),v_org_id,'Revisar cuentas por pagar','Facturas pendientes mes',  v_ts_por_hacer, 'high',   v_gestor_uid,today,  null),
  (gen_random_uuid(),v_org_id,'Reunión mensual equipo','Reunión seguimiento equipo',  v_ts_por_hacer, 'medium', v_gestor_uid,today+4,null),
  (gen_random_uuid(),v_org_id,'Análisis P&G mes anterior','Revisar con contador',     v_ts_por_hacer, 'high',   v_gestor_uid,today+2,null),
  (gen_random_uuid(),v_org_id,'Renovar contrato lavandería','Renovar proveedor',      v_ts_por_hacer, 'medium', v_gestor_uid,today+7,null),
  (gen_random_uuid(),v_org_id,'Actualizar manual procesos','Manual procedimientos',   v_ts_por_hacer, 'low',    v_gestor_uid,today+14,null),
  -- Tareas VENCIDAS
  (gen_random_uuid(),v_org_id,'Inventario amenities','Conteo amenities por piso',     v_ts_por_hacer, 'medium', v_cam1_uid,  today-3,null),
  (gen_random_uuid(),v_org_id,'Revisión CCTV','Verificar cámaras seguridad',          v_ts_por_hacer, 'high',   v_mant1_uid, today-2,null),
  (gen_random_uuid(),v_org_id,'Pedido insumos limpieza','Solicitar a proveedor',      v_ts_por_hacer, 'medium', v_cam2_uid,  today-1,null),
  (gen_random_uuid(),v_org_id,'Capacitación servicio','Taller atención al huésped',   v_ts_por_hacer, 'medium', v_gestor_uid,today-5,null),
  (gen_random_uuid(),v_org_id,'Auditoría llaves','Verificar llaves en circulación',   v_ts_por_hacer, 'medium', v_recep1_uid,today-2,null),
  -- Tareas COMPLETADAS
  (gen_random_uuid(),v_org_id,'Check-in grupo empresarial','Grupo 8 personas Acme',   v_ts_completada,'high',   v_recep1_uid,today-2,null),
  (gen_random_uuid(),v_org_id,'Reponer minibar 208','Minibar suite completo',          v_ts_completada,'low',    v_recep2_uid,today-1,(select id from public.rooms where organization_id=v_org_id and number='208')),
  (gen_random_uuid(),v_org_id,'Limpieza lobby','Limpieza profunda área lobby',         v_ts_completada,'medium', v_cam1_uid,  today-1,null),
  (gen_random_uuid(),v_org_id,'Inspección extintores piso 1','Revisar fechas venc.',   v_ts_completada,'medium', v_mant1_uid, today-3,null),
  (gen_random_uuid(),v_org_id,'Actualizar precios temporada','Temporada alta',         v_ts_completada,'high',   v_gestor_uid,today-5,null),
  (gen_random_uuid(),v_org_id,'Informe mensual propietarios','Enviar a dueños',        v_ts_completada,'high',   v_gestor_uid,today-7,null);

-- Auto-assign tasks to their creator
insert into public.task_assignees (task_id, profile_id)
select t.id, t.created_by
from public.tasks t
where t.organization_id = v_org_id;

-- =============================================================
-- STEP: Long-stay pricing on room types
-- =============================================================

update public.room_types set monthly_rate = 2400000, weekly_rate = 700000, biweekly_rate = 1300000 where organization_id = v_org_id and name = 'Estándar';
update public.room_types set monthly_rate = 3200000, weekly_rate = 900000, biweekly_rate = 1700000 where organization_id = v_org_id and name = 'Superior';
update public.room_types set monthly_rate = 5500000, weekly_rate = 1500000, biweekly_rate = 2900000 where organization_id = v_org_id and name = 'Suite';

-- =============================================================
-- Done
-- =============================================================

raise notice 'DEMO SEED COMPLETE: org=% id=%', 'Hotel Demo POSTY', v_org_id;

end;
$$;

-- Re-enable RLS
set session_replication_role = default;
