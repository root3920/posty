'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface TaskTemplate {
  id: string;
  title_template: string;
  description: string | null;
  subtasks: { text: string }[] | null;
  role_system_key: string | null;
  workflow: string | null;
  scope: string | null;
  anchor: string | null;
  offset_days: number;
  at_time: string | null;
  offset_minutes: number | null;
  priority: string;
  conditions: Record<string, unknown> | null;
  skip_if_past: boolean;
  is_active: boolean;
  sort_order: number;
  phase: string | null;
}

export interface RoleInfo {
  id: string;
  system_key: string;
  name: string;
  color: string;
}

// -------------------------------------------------------
// Fetch functions
// -------------------------------------------------------

async function fetchTaskTemplates(): Promise<TaskTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('task_templates')
    .select(
      'id, title_template, description, subtasks, role_system_key, workflow, scope, anchor, offset_days, at_time, offset_minutes, priority, conditions, skip_if_past, is_active, sort_order, phase',
    )
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as TaskTemplate[];
}

async function fetchRoles(): Promise<RoleInfo[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('roles')
    .select('id, system_key, name, color')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as RoleInfo[];
}

// -------------------------------------------------------
// Hooks
// -------------------------------------------------------

export function useTaskTemplates() {
  const templatesQuery = useQuery({
    queryKey: ['task_templates'],
    queryFn: fetchTaskTemplates,
    staleTime: 60 * 1000,
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    staleTime: 5 * 60 * 1000,
  });

  return {
    templates: templatesQuery.data ?? [],
    roles: rolesQuery.data ?? [],
    isLoading: templatesQuery.isLoading || rolesQuery.isLoading,
    isError: templatesQuery.isError,
    refetch: templatesQuery.refetch,
  };
}

export function useToggleTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('task_templates')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task_templates'] });
    },
  });
}

export function useResetDefaultTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const supabase = createClient();

      // Delete all existing templates for the org (RLS handles org scoping)
      const { error: deleteError } = await supabase
        .from('task_templates')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

      if (deleteError) throw deleteError;

      // Re-seed defaults via RPC
      const { error: rpcError } = await supabase.rpc('seed_default_task_templates');
      if (rpcError) throw rpcError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task_templates'] });
    },
  });
}
