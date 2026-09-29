'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface RecurringTask {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  subtasks: { text: string }[] | null;
  assigned_role_id: string | null;
  assigned_profile_id: string | null;
  room_id: string | null;
  frequency_type: 'daily' | 'weekly' | 'monthly_day' | 'every_n_days';
  frequency_config: Record<string, unknown>;
  at_time: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  role: { name: string; color: string } | null;
  profile: { full_name: string; avatar_url: string | null } | null;
  room: { name: string } | null;
}

// -------------------------------------------------------
// Fetch
// -------------------------------------------------------

async function fetchRecurringTasks(): Promise<RecurringTask[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('recurring_tasks')
    .select(
      `
      *,
      role:roles!recurring_tasks_assigned_role_id_fkey(name, color),
      profile:profiles!recurring_tasks_assigned_profile_id_fkey(full_name, avatar_url),
      room:rooms!recurring_tasks_room_id_fkey(name)
      `,
    )
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as RecurringTask[];
}

// -------------------------------------------------------
// Hooks
// -------------------------------------------------------

export function useRecurringTasks() {
  const query = useQuery({
    queryKey: ['recurring_tasks'],
    queryFn: fetchRecurringTasks,
    staleTime: 30 * 1000,
  });

  return {
    recurringTasks: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useCreateRecurringTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const supabase = createClient();

      // Get org from profile
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();
      if (profileError || !profile) throw new Error('Perfil no encontrado');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase
        .from('recurring_tasks')
        .insert({ ...data, organization_id: profile.organization_id } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_tasks'] });
    },
  });
}

export function useUpdateRecurringTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from('recurring_tasks').update(data as any).eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_tasks'] });
    },
  });
}

export function useDeleteRecurringTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from('recurring_tasks').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_tasks'] });
    },
  });
}

export function useToggleRecurringTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('recurring_tasks')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_tasks'] });
    },
  });
}
