-- =============================================================
-- POSTY — Phase 2: Medium bug fixes
-- Bug 4: Name fields — trim + non-empty check
-- Bug 6: Empty string dates → null
-- Bug 8: Global search RPC
-- Bug 9: Name length limit (60 chars)
-- =============================================================

-- -----------------------------------------------
-- Bug 4 + 9: Name field constraints
-- Add CHECK for non-empty trimmed name + max 60 chars
-- on all tables that have user-facing name columns.
-- -----------------------------------------------

-- First: fix existing data that violates the new constraints
update public.room_types set name = 'Sin nombre' where btrim(name) = '' or name is null;
update public.room_types set name = left(name, 60) where char_length(name) > 60;
update public.event_venues set name = 'Sin nombre' where btrim(name) = '' or name is null;
update public.event_venues set name = left(name, 60) where char_length(name) > 60;
update public.roles set name = left(name, 60) where char_length(name) > 60;
update public.task_statuses set name = left(name, 60) where char_length(name) > 60;
update public.task_labels set name = left(name, 60) where char_length(name) > 60;
update public.booking_channels set name = left(name, 60) where char_length(name) > 60;
update public.travel_reasons set name = left(name, 60) where char_length(name) > 60;
update public.payment_methods set name = left(name, 60) where char_length(name) > 60;
update public.revenue_centers set name = left(name, 60) where char_length(name) > 60;
update public.expense_categories set name = left(name, 60) where char_length(name) > 60;
update public.document_types set name = left(name, 60) where char_length(name) > 60;
update public.cleaning_types set name = left(name, 60) where char_length(name) > 60;
update public.shift_templates set name = left(name, 60) where char_length(name) > 60;
update public.guests set first_name = coalesce(nullif(btrim(first_name), ''), 'Sin nombre') where btrim(first_name) = '' or first_name is null;
update public.guests set first_name = left(first_name, 60) where char_length(first_name) > 60;
update public.guests set last_name = coalesce(nullif(btrim(last_name), ''), 'Sin apellido') where btrim(last_name) = '' or last_name is null;
update public.guests set last_name = left(last_name, 60) where char_length(last_name) > 60;

-- room_types
alter table public.room_types
  drop constraint if exists chk_room_types_name,
  add constraint chk_room_types_name check (char_length(btrim(name)) > 0 and char_length(name) <= 60);

-- event_venues
alter table public.event_venues
  drop constraint if exists chk_event_venues_name,
  add constraint chk_event_venues_name check (char_length(btrim(name)) > 0 and char_length(name) <= 60);

-- roles (user-created)
alter table public.roles
  drop constraint if exists chk_roles_name,
  add constraint chk_roles_name check (char_length(btrim(name)) > 0 and char_length(name) <= 60);

-- task_statuses
alter table public.task_statuses
  drop constraint if exists chk_task_statuses_name,
  add constraint chk_task_statuses_name check (char_length(btrim(name)) > 0 and char_length(name) <= 60);

-- task_labels
alter table public.task_labels
  drop constraint if exists chk_task_labels_name,
  add constraint chk_task_labels_name check (char_length(btrim(name)) > 0 and char_length(name) <= 60);

-- booking_channels
alter table public.booking_channels
  drop constraint if exists chk_booking_channels_name,
  add constraint chk_booking_channels_name check (char_length(btrim(name)) > 0 and char_length(name) <= 60);

-- travel_reasons
alter table public.travel_reasons
  drop constraint if exists chk_travel_reasons_name,
  add constraint chk_travel_reasons_name check (char_length(btrim(name)) > 0 and char_length(name) <= 60);

-- payment_methods
alter table public.payment_methods
  drop constraint if exists chk_payment_methods_name,
  add constraint chk_payment_methods_name check (char_length(btrim(name)) > 0 and char_length(name) <= 60);

-- revenue_centers
alter table public.revenue_centers
  drop constraint if exists chk_revenue_centers_name,
  add constraint chk_revenue_centers_name check (char_length(btrim(name)) > 0 and char_length(name) <= 60);

-- expense_categories
alter table public.expense_categories
  drop constraint if exists chk_expense_categories_name,
  add constraint chk_expense_categories_name check (char_length(btrim(name)) > 0 and char_length(name) <= 60);

-- document_types (code + name)
alter table public.document_types
  drop constraint if exists chk_document_types_name,
  add constraint chk_document_types_name check (char_length(btrim(name)) > 0 and char_length(name) <= 60);

-- cleaning_types
alter table public.cleaning_types
  drop constraint if exists chk_cleaning_types_name,
  add constraint chk_cleaning_types_name check (char_length(btrim(name)) > 0 and char_length(name) <= 60);

-- shift_templates
alter table public.shift_templates
  drop constraint if exists chk_shift_templates_name,
  add constraint chk_shift_templates_name check (char_length(btrim(name)) > 0 and char_length(name) <= 60);

-- guests: first_name + last_name
alter table public.guests
  drop constraint if exists chk_guests_first_name,
  add constraint chk_guests_first_name check (char_length(btrim(first_name)) > 0 and char_length(first_name) <= 60);
alter table public.guests
  drop constraint if exists chk_guests_last_name,
  add constraint chk_guests_last_name check (char_length(btrim(last_name)) > 0 and char_length(last_name) <= 60);

-- organizations
alter table public.organizations
  drop constraint if exists chk_organizations_name,
  add constraint chk_organizations_name check (char_length(btrim(name)) > 0 and char_length(name) <= 100);

-- -----------------------------------------------
-- Bug 8: Global search RPC
-- -----------------------------------------------
create or replace function public.global_search(p_query text, p_limit int default 10)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
  v_q text;
  v_results jsonb := '[]'::jsonb;
  v_guests jsonb;
  v_rooms jsonb;
  v_tasks jsonb;
  v_stays jsonb;
  v_events jsonb;
begin
  select organization_id into v_org_id from public.profiles where id = auth.uid();
  if v_org_id is null then return '[]'::jsonb; end if;

  v_q := btrim(p_query);
  if char_length(v_q) < 2 then return '[]'::jsonb; end if;

  -- Guests
  select coalesce(jsonb_agg(jsonb_build_object(
    'type', 'guest',
    'id', g.id,
    'title', g.first_name || ' ' || g.last_name,
    'subtitle', coalesce(g.document_number, g.phone, g.email),
    'href', '/hotel/huespedes/' || g.id
  )), '[]'::jsonb)
  into v_guests
  from (
    select id, first_name, last_name, document_number, phone, email
    from public.guests
    where organization_id = v_org_id
      and archived_at is null
      and (
        first_name ilike '%' || v_q || '%'
        or last_name ilike '%' || v_q || '%'
        or document_number ilike '%' || v_q || '%'
        or phone ilike '%' || v_q || '%'
        or email ilike '%' || v_q || '%'
      )
    order by last_name, first_name
    limit p_limit
  ) g;

  -- Rooms
  select coalesce(jsonb_agg(jsonb_build_object(
    'type', 'room',
    'id', r.id,
    'title', 'Hab. ' || r.number,
    'subtitle', r.type_name,
    'href', '/hotel/habitaciones'
  )), '[]'::jsonb)
  into v_rooms
  from (
    select r.id, r.number, rt.name as type_name
    from public.rooms r
    join public.room_types rt on rt.id = r.room_type_id
    where r.organization_id = v_org_id
      and r.is_active = true
      and (
        r.number ilike '%' || v_q || '%'
        or rt.name ilike '%' || v_q || '%'
      )
    order by r.number
    limit p_limit
  ) r;

  -- Tasks
  select coalesce(jsonb_agg(jsonb_build_object(
    'type', 'task',
    'id', t.id,
    'title', t.title,
    'subtitle', coalesce(t.status_name, ''),
    'href', '/tareas'
  )), '[]'::jsonb)
  into v_tasks
  from (
    select t.id, t.title, ts.name as status_name
    from public.tasks t
    left join public.task_statuses ts on ts.id = t.status_id
    where t.organization_id = v_org_id
      and t.title ilike '%' || v_q || '%'
    order by t.created_at desc
    limit p_limit
  ) t;

  -- Stays (reservations)
  select coalesce(jsonb_agg(jsonb_build_object(
    'type', 'stay',
    'id', s.id,
    'title', s.code || ' — ' || g.first_name || ' ' || g.last_name,
    'subtitle', s.status::text,
    'href', '/hotel/reservas'
  )), '[]'::jsonb)
  into v_stays
  from (
    select s.id, s.code, s.status, s.primary_guest_id
    from public.stays s
    where s.organization_id = v_org_id
      and (
        s.code ilike '%' || v_q || '%'
      )
    order by s.created_at desc
    limit p_limit
  ) s
  join public.guests g on g.id = s.primary_guest_id;

  -- Events
  select coalesce(jsonb_agg(jsonb_build_object(
    'type', 'event',
    'id', eb.id,
    'title', eb.code || ' — ' || eb.client_name,
    'subtitle', ev.name || ' · ' || eb.event_date::text,
    'href', '/eventos'
  )), '[]'::jsonb)
  into v_events
  from (
    select eb.id, eb.code, eb.client_name, eb.venue_id, eb.event_date
    from public.event_bookings eb
    where eb.organization_id = v_org_id
      and (
        eb.code ilike '%' || v_q || '%'
        or eb.client_name ilike '%' || v_q || '%'
      )
    order by eb.created_at desc
    limit p_limit
  ) eb
  join public.event_venues ev on ev.id = eb.venue_id;

  -- Merge results
  v_results := v_guests || v_rooms || v_tasks || v_stays || v_events;

  return v_results;
end;
$$;
