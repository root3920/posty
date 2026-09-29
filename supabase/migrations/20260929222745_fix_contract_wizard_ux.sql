-- =============================================================
-- POSTY — Fix: available_rooms_for_contract returns ALL room types
-- Shows types without monthly_rate so the wizard can set it inline
-- =============================================================

drop function if exists public.available_rooms_for_contract(date, date);

create or replace function public.available_rooms_for_contract(
  p_start_date date,
  p_end_date date
)
returns table (
  id uuid,
  name text,
  base_rate numeric(14,2),
  monthly_rate numeric(14,2),
  weekly_rate numeric(14,2),
  biweekly_rate numeric(14,2),
  max_adults int,
  max_children int,
  available_count bigint,
  total_rooms bigint,
  first_available_date date
)
language sql
security definer
stable
set search_path = public
as $$
  with org as (
    select organization_id from public.profiles where id = auth.uid() limit 1
  ),
  blocked_rooms as (
    select distinct s.room_id
    from public.stays s
    where s.status in ('reserved', 'checked_in')
      and s.check_in_date < p_end_date
      and s.check_out_date > p_start_date
  ),
  -- For rooms that are blocked, find when each one becomes free
  next_free as (
    select s.room_id,
      min(s.check_out_date) as free_from
    from public.stays s
    where s.status in ('reserved', 'checked_in')
      and s.check_out_date > p_start_date
      and s.room_id in (select room_id from blocked_rooms)
    group by s.room_id
  )
  select
    rt.id,
    rt.name,
    rt.base_rate,
    rt.monthly_rate,
    rt.weekly_rate,
    rt.biweekly_rate,
    rt.max_adults,
    rt.max_children,
    count(r.id) filter (
      where r.is_active = true
        and r.id not in (select room_id from blocked_rooms)
    ) as available_count,
    count(r.id) filter (where r.is_active = true) as total_rooms,
    min(nf.free_from) filter (
      where r.is_active = true
        and r.id in (select room_id from blocked_rooms)
    ) as first_available_date
  from public.room_types rt
  cross join org
  left join public.rooms r
    on r.room_type_id = rt.id
    and r.organization_id = org.organization_id
  left join next_free nf on nf.room_id = r.id
  where rt.organization_id = org.organization_id
    and rt.is_active = true
    and rt.archived_at is null
  group by rt.id, rt.name, rt.base_rate, rt.monthly_rate, rt.weekly_rate, rt.biweekly_rate, rt.max_adults, rt.max_children
  order by rt.name;
$$;

grant execute on function public.available_rooms_for_contract(date, date) to authenticated;

-- =============================================================
-- RPC to set monthly_rate on a room type (for inline wizard update)
-- =============================================================

create or replace function public.set_room_type_monthly_rate(
  p_room_type_id uuid,
  p_monthly_rate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id
  from public.profiles where id = auth.uid() limit 1;

  update public.room_types
  set monthly_rate = p_monthly_rate
  where id = p_room_type_id
    and organization_id = v_org_id;
end;
$$;

grant execute on function public.set_room_type_monthly_rate(uuid, numeric) to authenticated;
