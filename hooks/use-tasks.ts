'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Tables, Enums } from '@/types/database';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export type TaskPriority = Enums<'task_priority'>;
export type TaskStatusType = Enums<'task_status_type'>;

export interface TaskAssignee {
  id: string;
  profile_id: string;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface TaskLabel {
  id: string;
  label_id: string;
  label: {
    id: string;
    name: string;
    color: string;
  };
}

export interface TaskWithRelations extends Tables<'tasks'> {
  status: Tables<'task_statuses'> | null;
  assignees: TaskAssignee[];
  labels: TaskLabel[];
  subtask_count: number;
}

export interface TaskFilters {
  statusId?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  labelId?: string;
  dateFrom?: string;
  dateTo?: string;
  parentTaskId?: string | null;
}

// -------------------------------------------------------
// Fetch tasks
// -------------------------------------------------------

async function fetchTasks(filters: TaskFilters): Promise<TaskWithRelations[]> {
  const supabase = createClient();

  let query = supabase
    .from('tasks')
    .select(
      `
      *,
      status:task_statuses(id, name, color, sort_order, type),
      assignees:task_assignees(
        id,
        profile_id,
        profile:profiles(id, full_name, avatar_url)
      ),
      labels:task_label_links(
        id,
        label_id,
        label:task_labels(id, name, color)
      )
      `,
    )
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters.statusId) {
    query = query.eq('status_id', filters.statusId);
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }
  if (filters.assigneeId) {
    // Filter tasks that have this assignee
    query = query.eq('task_assignees.profile_id', filters.assigneeId);
  }
  if (filters.labelId) {
    query = query.eq('task_label_links.label_id', filters.labelId);
  }
  if (filters.dateFrom) {
    query = query.gte('due_date', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('due_date', filters.dateTo);
  }
  if (filters.parentTaskId !== undefined) {
    if (filters.parentTaskId === null) {
      query = query.is('parent_task_id', null);
    } else {
      query = query.eq('parent_task_id', filters.parentTaskId);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  // Compute subtask_count for each task
  const taskIds = (data ?? []).map((t) => t.id);
  let subtaskCounts: Record<string, number> = {};

  if (taskIds.length > 0) {
    const { data: subtaskData } = await supabase
      .from('tasks')
      .select('parent_task_id')
      .in('parent_task_id', taskIds)
      .is('archived_at', null);

    if (subtaskData) {
      for (const row of subtaskData) {
        if (row.parent_task_id) {
          subtaskCounts[row.parent_task_id] = (subtaskCounts[row.parent_task_id] ?? 0) + 1;
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (data ?? []) as any[];
  return raw.map((task) => ({
    ...task,
    status: task.status ?? null,
    assignees: (task.assignees ?? []) as TaskAssignee[],
    labels: (task.labels ?? []) as TaskLabel[],
    subtask_count: subtaskCounts[task.id] ?? 0,
  })) as TaskWithRelations[];
}

// -------------------------------------------------------
// Fetch statuses
// -------------------------------------------------------

async function fetchStatuses(): Promise<Tables<'task_statuses'>[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('task_statuses')
    .select('*')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// -------------------------------------------------------
// Fetch labels
// -------------------------------------------------------

async function fetchLabels(): Promise<Tables<'task_labels'>[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('task_labels')
    .select('*')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// -------------------------------------------------------
// Fetch team profiles for assignee selectors
// -------------------------------------------------------

export interface TeamMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  job_title: string | null;
}

async function fetchTeamMembers(): Promise<TeamMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, job_title')
    .eq('is_active', true)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TeamMember[];
}

// -------------------------------------------------------
// useTasks hook
// -------------------------------------------------------

export function useTasks(filters: TaskFilters = {}) {
  const tasksQuery = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => fetchTasks(filters),
    staleTime: 30 * 1000,
  });

  const statusesQuery = useQuery({
    queryKey: ['task_statuses'],
    queryFn: fetchStatuses,
    staleTime: 5 * 60 * 1000,
  });

  const labelsQuery = useQuery({
    queryKey: ['task_labels'],
    queryFn: fetchLabels,
    staleTime: 5 * 60 * 1000,
  });

  const teamQuery = useQuery({
    queryKey: ['team_members'],
    queryFn: fetchTeamMembers,
    staleTime: 5 * 60 * 1000,
  });

  return {
    tasks: tasksQuery.data ?? [],
    statuses: statusesQuery.data ?? [],
    labels: labelsQuery.data ?? [],
    teamMembers: teamQuery.data ?? [],
    isLoading:
      tasksQuery.isLoading ||
      statusesQuery.isLoading ||
      labelsQuery.isLoading ||
      teamQuery.isLoading,
    isError: tasksQuery.isError,
    refetch: tasksQuery.refetch,
  };
}

// -------------------------------------------------------
// useTaskDetail hook — fetches a single task with all data
// -------------------------------------------------------

export interface TaskComment extends Tables<'task_comments'> {
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export interface TaskActivity extends Tables<'task_activity'> {
  actor: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

async function fetchTaskDetail(taskId: string) {
  const supabase = createClient();

  const [taskRes, commentsRes, activityRes, subtasksRes] = await Promise.all([
    supabase
      .from('tasks')
      .select(
        `
        *,
        status:task_statuses(id, name, color, sort_order, type),
        assignees:task_assignees(
          id,
          profile_id,
          profile:profiles(id, full_name, avatar_url)
        ),
        labels:task_label_links(
          id,
          label_id,
          label:task_labels(id, name, color)
        )
        `,
      )
      .eq('id', taskId)
      .single(),

    supabase
      .from('task_comments')
      .select(
        `
        *,
        author:profiles(id, full_name, avatar_url)
        `,
      )
      .eq('task_id', taskId)
      .order('created_at', { ascending: true }),

    supabase
      .from('task_activity')
      .select(
        `
        *,
        actor:profiles(id, full_name, avatar_url)
        `,
      )
      .eq('task_id', taskId)
      .order('created_at', { ascending: false }),

    supabase
      .from('tasks')
      .select(
        `
        *,
        status:task_statuses(id, name, color, type),
        assignees:task_assignees(
          id,
          profile_id,
          profile:profiles(id, full_name, avatar_url)
        )
        `,
      )
      .eq('parent_task_id', taskId)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
  ]);

  if (taskRes.error) throw taskRes.error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTask = taskRes.data as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSubtasks = (subtasksRes.data ?? []) as any[];

  return {
    task: {
      ...rawTask,
      status: rawTask.status ?? null,
      assignees: (rawTask.assignees ?? []) as TaskAssignee[],
      labels: (rawTask.labels ?? []) as TaskLabel[],
      subtask_count: rawSubtasks.length,
    } as TaskWithRelations,
    comments: ((commentsRes.data ?? []) as unknown) as TaskComment[],
    activity: ((activityRes.data ?? []) as unknown) as TaskActivity[],
    subtasks: rawSubtasks.map((s: any) => ({
      ...s,
      status: s.status ?? null,
      assignees: (s.assignees ?? []) as TaskAssignee[],
      labels: [] as TaskLabel[],
      subtask_count: 0,
    })) as TaskWithRelations[],
  };
}

export function useTaskDetail(taskId: string | null) {
  return useQuery({
    queryKey: ['task_detail', taskId],
    queryFn: () => fetchTaskDetail(taskId!),
    enabled: !!taskId,
    staleTime: 30 * 1000,
  });
}
