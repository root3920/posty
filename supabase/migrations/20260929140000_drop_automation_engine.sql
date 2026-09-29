-- =============================================================
-- POSTY — Drop automation engine (too complex for hotel managers)
-- Keeps: task_templates, generate_stay_tasks, housekeeping, pg_cron infra
-- =============================================================

-- -----------------------------------------------
-- 1. Unschedule pg_cron job
-- -----------------------------------------------
select cron.unschedule('automation-queue');

-- -----------------------------------------------
-- 2. Drop triggers from stays, rooms, tasks
-- -----------------------------------------------
drop trigger if exists on_stay_automation_event on public.stays;
drop trigger if exists on_room_automation_event on public.rooms;
drop trigger if exists on_task_automation_event on public.tasks;

-- -----------------------------------------------
-- 3. Drop trigger functions
-- -----------------------------------------------
drop function if exists public.trg_emit_stay_event();
drop function if exists public.trg_emit_room_event();
drop function if exists public.trg_emit_task_event();

-- -----------------------------------------------
-- 4. Drop action executors + queue processor
-- -----------------------------------------------
drop function if exists public.execute_automation_create_task(uuid, jsonb, jsonb, uuid);
drop function if exists public.execute_automation_notify(uuid, jsonb, jsonb);
drop function if exists public.process_automation_queue();

-- -----------------------------------------------
-- 5. Drop tables (cascade drops RLS policies, indexes, triggers)
-- -----------------------------------------------
drop table if exists public.automation_run_steps cascade;
drop table if exists public.automation_runs cascade;
drop table if exists public.automation_steps cascade;
drop table if exists public.automation_events cascade;
drop table if exists public.automations cascade;

-- -----------------------------------------------
-- 6. Remove permissions
-- -----------------------------------------------
delete from public.role_permissions where permission_key like 'automations.%';
delete from public.permissions where key like 'automations.%';
