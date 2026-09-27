-- =============================================================
-- POSTY — Migration: Grant execute on RPCs to authenticated
-- Ensures RPC functions are callable by logged-in users (not just service_role)
-- =============================================================

grant execute on function public.available_rooms_by_type(date, date) to authenticated;

grant execute on function public.create_stay_with_auto_room(uuid, uuid, date, date, text, int, int, numeric, uuid, uuid, text, text, text, uuid, text, text, date, text, text, text, text, text, text) to authenticated;

grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.get_my_permissions() to authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.team_task_stats(date, date) to authenticated;
grant execute on function public.seed_organization_defaults(uuid) to authenticated;
grant execute on function public.current_org_id() to authenticated;
