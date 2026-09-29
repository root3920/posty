'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('No autenticado');
  return { supabase, user };
}

// -------------------------------------------------------
// createRecurringTaskAction
// -------------------------------------------------------

export async function createRecurringTaskAction(data: Record<string, unknown>) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    // Get user's organization_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { error: 'Perfil no encontrado' };
    }

    const { data: task, error } = await supabase
      .from('recurring_tasks')
      .insert({
        organization_id: profile.organization_id,
        title: data.title as string,
        frequency_type: data.frequency_type as string,
        frequency_config: (data.frequency_config ?? {}) as import('@/types/database').Json,
        at_time: data.at_time as string | undefined,
        priority: data.priority as string | undefined,
        description: data.description as string | undefined,
        subtasks: (data.subtasks ?? []) as import('@/types/database').Json,
        assigned_role_id: data.assigned_role_id as string | undefined,
        assigned_profile_id: data.assigned_profile_id as string | undefined,
        room_id: data.room_id as string | undefined,
        start_date: data.start_date as string | undefined,
        end_date: data.end_date as string | undefined,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error || !task) {
      logSupabaseError(error, 'createRecurringTaskAction');
      return { error: getSupabaseErrorMessage(error, 'Tarea recurrente') };
    }

    revalidatePath('/configuracion');
    return { success: true, taskId: task.id };
  } catch (err) {
    console.error('createRecurringTaskAction error:', err);
    return { error: 'Error inesperado al crear la tarea recurrente' };
  }
}

// -------------------------------------------------------
// updateRecurringTaskAction
// -------------------------------------------------------

export async function updateRecurringTaskAction(id: string, data: Record<string, unknown>) {
  try {
    const { supabase } = await getAuthenticatedUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('recurring_tasks').update(data as any).eq('id', id);

    if (error) {
      logSupabaseError(error, 'updateRecurringTaskAction');
      return { error: getSupabaseErrorMessage(error, 'Tarea recurrente') };
    }

    revalidatePath('/configuracion');
    return { success: true };
  } catch (err) {
    console.error('updateRecurringTaskAction error:', err);
    return { error: 'Error inesperado al actualizar la tarea recurrente' };
  }
}

// -------------------------------------------------------
// deleteRecurringTaskAction
// -------------------------------------------------------

export async function deleteRecurringTaskAction(id: string) {
  try {
    const { supabase } = await getAuthenticatedUser();

    const { error } = await supabase.from('recurring_tasks').delete().eq('id', id);

    if (error) {
      logSupabaseError(error, 'deleteRecurringTaskAction');
      return { error: getSupabaseErrorMessage(error, 'Tarea recurrente') };
    }

    revalidatePath('/configuracion');
    return { success: true };
  } catch (err) {
    console.error('deleteRecurringTaskAction error:', err);
    return { error: 'Error inesperado al eliminar la tarea recurrente' };
  }
}

// -------------------------------------------------------
// toggleRecurringTaskAction
// -------------------------------------------------------

export async function toggleRecurringTaskAction(id: string, isActive: boolean) {
  try {
    const { supabase } = await getAuthenticatedUser();

    const { error } = await supabase
      .from('recurring_tasks')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      logSupabaseError(error, 'toggleRecurringTaskAction');
      return { error: getSupabaseErrorMessage(error, 'Tarea recurrente') };
    }

    revalidatePath('/configuracion');
    return { success: true };
  } catch (err) {
    console.error('toggleRecurringTaskAction error:', err);
    return { error: 'Error inesperado al cambiar el estado de la tarea recurrente' };
  }
}
