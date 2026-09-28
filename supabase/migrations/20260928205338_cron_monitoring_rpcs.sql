-- =============================================================
-- POSTY — Cron monitoring RPCs for the config page
-- Security definer: only returns data, no mutations
-- =============================================================

create or replace function public.get_cron_jobs()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(j)), '[]'::json)
  from (
    select jobid, jobname, schedule, command, active
    from cron.job
    order by jobid
  ) j;
$$;

create or replace function public.get_cron_run_details()
returns json
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(r)), '[]'::json)
  from (
    select runid, jobid, status, start_time, end_time, return_message
    from cron.job_run_details
    order by start_time desc
    limit 100
  ) r;
$$;
