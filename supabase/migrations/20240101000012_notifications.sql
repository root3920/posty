-- =============================================================
-- POSTY — Migration: Notifications
-- =============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null,                   -- 'task_assigned', 'task_mentioned', 'stay_checkout', etc.
  title text not null,
  body text,
  link text,                            -- relative URL to navigate to
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_profile on public.notifications(profile_id, is_read, created_at desc);

-- RLS
alter table public.notifications enable row level security;

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
