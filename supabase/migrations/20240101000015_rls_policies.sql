-- =============================================================
-- POSTY — Migration: ALL RLS policies (centralized)
--
-- This migration runs AFTER all tables exist, avoiding forward
-- references to public.profiles from earlier migrations.
--
-- Uses a security definer helper current_org_id() with a fixed
-- search_path to avoid RLS recursion on profiles.
-- =============================================================

-- -----------------------------------------------
-- Helper: current_org_id()
-- Returns the organization_id of the current auth user.
-- security definer + search_path = public so it bypasses
-- RLS on profiles (avoids infinite recursion).
-- -----------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

-- =============================================================
-- ORGANIZATIONS
-- =============================================================

create policy "Users can view own organization"
  on public.organizations for select
  using (id = public.current_org_id());

create policy "Members can update own organization"
  on public.organizations for update
  using (id = public.current_org_id());

-- =============================================================
-- ROLES
-- =============================================================

create policy "Users can view roles of own org"
  on public.roles for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage roles"
  on public.roles for all
  using (organization_id = public.current_org_id());

-- =============================================================
-- ROLE_PERMISSIONS
-- =============================================================

create policy "Users can view role_permissions of own org"
  on public.role_permissions for select
  using (
    role_id in (
      select id from public.roles
      where organization_id = public.current_org_id()
    )
  );

create policy "Org members can manage role_permissions"
  on public.role_permissions for all
  using (
    role_id in (
      select id from public.roles
      where organization_id = public.current_org_id()
    )
  );

-- =============================================================
-- PROFILES
-- =============================================================

create policy "Users can view profiles of own org"
  on public.profiles for select
  using (organization_id = public.current_org_id());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Insert handled by service_role during registration/invitation
create policy "Service role can insert profiles"
  on public.profiles for insert
  with check (true);

-- =============================================================
-- CATALOG TABLES (all org-scoped, same pattern)
-- =============================================================
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'task_statuses', 'room_statuses', 'room_types', 'document_types',
      'booking_channels', 'travel_reasons', 'payment_methods',
      'revenue_centers', 'expense_categories', 'task_labels'
    ])
  loop
    execute format(
      'create policy "Users can view %1$s of own org" on public.%1$I for select using (
        organization_id = public.current_org_id()
      )', tbl
    );

    execute format(
      'create policy "Org members can manage %1$s" on public.%1$I for all using (
        organization_id = public.current_org_id()
      )', tbl
    );
  end loop;
end;
$$;

-- =============================================================
-- SHIFT_TEMPLATES
-- =============================================================

create policy "Users can view shift_templates of own org"
  on public.shift_templates for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage shift_templates"
  on public.shift_templates for all
  using (organization_id = public.current_org_id());

-- =============================================================
-- WORK_SCHEDULES
-- =============================================================

create policy "Users can view work_schedules of own org"
  on public.work_schedules for select
  using (
    profile_id in (
      select id from public.profiles
      where organization_id = public.current_org_id()
    )
  );

create policy "Org members can manage work_schedules"
  on public.work_schedules for all
  using (
    profile_id in (
      select id from public.profiles
      where organization_id = public.current_org_id()
    )
  );

-- =============================================================
-- TIME_OFF
-- =============================================================

create policy "Users can view time_off of own org"
  on public.time_off for select
  using (
    profile_id in (
      select id from public.profiles
      where organization_id = public.current_org_id()
    )
  );

create policy "Org members can manage time_off"
  on public.time_off for all
  using (
    profile_id in (
      select id from public.profiles
      where organization_id = public.current_org_id()
    )
  );

-- =============================================================
-- TASKS
-- =============================================================

create policy "Users can view tasks of own org"
  on public.tasks for select
  using (organization_id = public.current_org_id());

create policy "Org members can insert tasks"
  on public.tasks for insert
  with check (organization_id = public.current_org_id());

create policy "Org members can update tasks"
  on public.tasks for update
  using (organization_id = public.current_org_id());

create policy "Org members can delete tasks"
  on public.tasks for delete
  using (organization_id = public.current_org_id());

-- =============================================================
-- TASK_ASSIGNEES
-- =============================================================

create policy "Users can view task_assignees of own org"
  on public.task_assignees for select
  using (
    task_id in (
      select id from public.tasks
      where organization_id = public.current_org_id()
    )
  );

create policy "Org members can manage task_assignees"
  on public.task_assignees for all
  using (
    task_id in (
      select id from public.tasks
      where organization_id = public.current_org_id()
    )
  );

-- =============================================================
-- TASK_LABEL_LINKS
-- =============================================================

create policy "Users can view task_label_links of own org"
  on public.task_label_links for select
  using (
    task_id in (
      select id from public.tasks
      where organization_id = public.current_org_id()
    )
  );

create policy "Org members can manage task_label_links"
  on public.task_label_links for all
  using (
    task_id in (
      select id from public.tasks
      where organization_id = public.current_org_id()
    )
  );

-- =============================================================
-- TASK_COMMENTS
-- =============================================================

create policy "Users can view task_comments of own org"
  on public.task_comments for select
  using (
    task_id in (
      select id from public.tasks
      where organization_id = public.current_org_id()
    )
  );

create policy "Org members can insert task_comments"
  on public.task_comments for insert
  with check (
    task_id in (
      select id from public.tasks
      where organization_id = public.current_org_id()
    )
  );

-- =============================================================
-- TASK_ACTIVITY (read-only for users; written by security definer trigger)
-- =============================================================

create policy "Users can view task_activity of own org"
  on public.task_activity for select
  using (
    task_id in (
      select id from public.tasks
      where organization_id = public.current_org_id()
    )
  );

-- =============================================================
-- ROOMS
-- =============================================================

create policy "Users can view rooms of own org"
  on public.rooms for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage rooms"
  on public.rooms for all
  using (organization_id = public.current_org_id());

-- =============================================================
-- GUESTS
-- =============================================================

create policy "Users can view guests of own org"
  on public.guests for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage guests"
  on public.guests for all
  using (organization_id = public.current_org_id());

-- =============================================================
-- STAYS
-- =============================================================

create policy "Users can view stays of own org"
  on public.stays for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage stays"
  on public.stays for all
  using (organization_id = public.current_org_id());

-- =============================================================
-- STAY_GUESTS
-- =============================================================

create policy "Users can view stay_guests of own org"
  on public.stay_guests for select
  using (
    stay_id in (
      select id from public.stays
      where organization_id = public.current_org_id()
    )
  );

create policy "Org members can manage stay_guests"
  on public.stay_guests for all
  using (
    stay_id in (
      select id from public.stays
      where organization_id = public.current_org_id()
    )
  );

-- =============================================================
-- FOLIO_CHARGES
-- =============================================================

create policy "Users can view folio_charges of own org"
  on public.folio_charges for select
  using (
    stay_id in (
      select id from public.stays
      where organization_id = public.current_org_id()
    )
  );

create policy "Org members can manage folio_charges"
  on public.folio_charges for all
  using (
    stay_id in (
      select id from public.stays
      where organization_id = public.current_org_id()
    )
  );

-- =============================================================
-- PAYMENTS
-- =============================================================

create policy "Users can view payments of own org"
  on public.payments for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage payments"
  on public.payments for all
  using (organization_id = public.current_org_id());

-- =============================================================
-- EXPENSES
-- =============================================================

create policy "Users can view expenses of own org"
  on public.expenses for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage expenses"
  on public.expenses for all
  using (organization_id = public.current_org_id());

-- =============================================================
-- OTHER_REVENUE
-- =============================================================

create policy "Users can view other_revenue of own org"
  on public.other_revenue for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage other_revenue"
  on public.other_revenue for all
  using (organization_id = public.current_org_id());

-- =============================================================
-- BUDGETS
-- =============================================================

create policy "Users can view budgets of own org"
  on public.budgets for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage budgets"
  on public.budgets for all
  using (organization_id = public.current_org_id());

-- =============================================================
-- DAILY_ROOM_SNAPSHOTS
-- =============================================================

create policy "Users can view snapshots of own org"
  on public.daily_room_snapshots for select
  using (organization_id = public.current_org_id());

create policy "Org members can manage snapshots"
  on public.daily_room_snapshots for all
  using (organization_id = public.current_org_id());

-- =============================================================
-- NOTIFICATIONS
-- =============================================================

create policy "Users can view own notifications"
  on public.notifications for select
  using (profile_id = auth.uid());

create policy "Users can update own notifications"
  on public.notifications for update
  using (profile_id = auth.uid());

-- Insert by system (triggers/service_role)
create policy "System can insert notifications"
  on public.notifications for insert
  with check (true);
