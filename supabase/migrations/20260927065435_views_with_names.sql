-- =============================================================
-- POSTY — Migration: Views with human-readable names
-- All views use security_invoker = true to respect RLS.
-- =============================================================

-- -----------------------------------------------
-- stays_view
-- -----------------------------------------------
create or replace view public.stays_view
  with (security_invoker = true)
as
select
  s.*,
  r.number   as room_number,
  r.floor    as room_floor,
  rt.name    as room_type_name,
  rt.base_rate as room_type_rate,
  g.first_name as guest_first_name,
  g.last_name  as guest_last_name,
  g.first_name || ' ' || g.last_name as guest_full_name,
  dt.code    as guest_document_type_code,
  g.document_number as guest_document_number,
  g.phone    as guest_phone,
  g.email    as guest_email,
  bc.name    as channel_name,
  tr.name    as travel_reason_name,
  coalesce(fc_total.total_charges, 0) as total_charges,
  coalesce(pay_total.total_payments, 0) as total_payments,
  coalesce(fc_total.total_charges, 0) - coalesce(pay_total.total_payments, 0) as balance
from public.stays s
left join public.rooms r on r.id = s.room_id
left join public.room_types rt on rt.id = r.room_type_id
left join public.guests g on g.id = s.primary_guest_id
left join public.document_types dt on dt.id = g.document_type_id
left join public.booking_channels bc on bc.id = s.channel_id
left join public.travel_reasons tr on tr.id = s.travel_reason_id
left join lateral (
  select sum(fc.total) as total_charges
  from public.folio_charges fc where fc.stay_id = s.id
) fc_total on true
left join lateral (
  select sum(p.amount) as total_payments
  from public.payments p where p.stay_id = s.id
) pay_total on true;

-- -----------------------------------------------
-- tasks_view
-- -----------------------------------------------
create or replace view public.tasks_view
  with (security_invoker = true)
as
select
  t.*,
  ts.name    as status_name,
  ts.color   as status_color,
  ts.type    as status_type,
  p_creator.full_name as created_by_name,
  rm.number  as room_number,
  rm.floor   as room_floor
from public.tasks t
left join public.task_statuses ts on ts.id = t.status_id
left join public.profiles p_creator on p_creator.id = t.created_by
left join public.rooms rm on rm.id = t.room_id;

-- -----------------------------------------------
-- expenses_view
-- -----------------------------------------------
create or replace view public.expenses_view
  with (security_invoker = true)
as
select
  e.*,
  ec.name           as category_name,
  ec.category_group as category_group_name,
  p_creator.full_name as created_by_name
from public.expenses e
left join public.expense_categories ec on ec.id = e.category_id
left join public.profiles p_creator on p_creator.id = e.created_by;

-- -----------------------------------------------
-- rooms_view
-- -----------------------------------------------
create or replace view public.rooms_view
  with (security_invoker = true)
as
select
  r.*,
  rt.name    as room_type_name,
  rt.base_rate as room_type_rate,
  rt.max_adults,
  rt.max_children,
  rs.name    as status_name,
  rs.color   as status_color,
  rs.counts_as_available,
  rs.counts_as_out_of_order
from public.rooms r
left join public.room_types rt on rt.id = r.room_type_id
left join public.room_statuses rs on rs.id = r.status_id;

-- -----------------------------------------------
-- other_revenue_view
-- -----------------------------------------------
create or replace view public.other_revenue_view
  with (security_invoker = true)
as
select
  orv.*,
  rc.name as revenue_center_name,
  p_creator.full_name as created_by_name
from public.other_revenue orv
left join public.revenue_centers rc on rc.id = orv.revenue_center_id
left join public.profiles p_creator on p_creator.id = orv.created_by;
