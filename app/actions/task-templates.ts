'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface TaskTemplateData {
  title_template?: string;
  description?: string | null;
  subtasks?: { text: string }[] | null;
  role_system_key?: string | null;
  workflow?: string | null;
  scope?: string | null;
  anchor?: string | null;
  offset_days?: number;
  at_time?: string | null;
  offset_minutes?: number | null;
  priority?: string;
  conditions?: Record<string, unknown> | null;
  skip_if_past?: boolean;
  is_active?: boolean;
  sort_order?: number;
  phase?: string | null;
}

export interface CreateTaskTemplateData extends TaskTemplateData {
  title_template: string;
  priority: string;
  offset_days: number;
}

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
// updateTaskTemplateAction
// -------------------------------------------------------

export async function updateTaskTemplateAction(id: string, data: TaskTemplateData) {
  try {
    const { supabase } = await getAuthenticatedUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('task_templates').update(data as any).eq('id', id);

    if (error) {
      logSupabaseError(error, 'updateTaskTemplateAction');
      return { error: getSupabaseErrorMessage(error, 'Plantilla') };
    }

    revalidatePath('/configuracion');
    return { success: true };
  } catch (err) {
    console.error('updateTaskTemplateAction error:', err);
    return { error: 'Error inesperado al actualizar la plantilla' };
  }
}

// -------------------------------------------------------
// createTaskTemplateAction
// -------------------------------------------------------

export async function createTaskTemplateAction(data: CreateTaskTemplateData) {
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

    const { data: template, error } = await supabase
      .from('task_templates')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({ ...data, organization_id: profile.organization_id } as any)
      .select('id')
      .single();

    if (error || !template) {
      logSupabaseError(error, 'createTaskTemplateAction');
      return { error: getSupabaseErrorMessage(error, 'Plantilla') };
    }

    revalidatePath('/configuracion');
    return { success: true, templateId: template.id };
  } catch (err) {
    console.error('createTaskTemplateAction error:', err);
    return { error: 'Error inesperado al crear la plantilla' };
  }
}

// -------------------------------------------------------
// deleteTaskTemplateAction
// -------------------------------------------------------

export async function deleteTaskTemplateAction(id: string) {
  try {
    const { supabase } = await getAuthenticatedUser();

    const { error } = await supabase.from('task_templates').delete().eq('id', id);

    if (error) {
      logSupabaseError(error, 'deleteTaskTemplateAction');
      return { error: getSupabaseErrorMessage(error, 'Plantilla') };
    }

    revalidatePath('/configuracion');
    return { success: true };
  } catch (err) {
    console.error('deleteTaskTemplateAction error:', err);
    return { error: 'Error inesperado al eliminar la plantilla' };
  }
}

// -------------------------------------------------------
// toggleTaskTemplateAction
// -------------------------------------------------------

export async function toggleTaskTemplateAction(id: string, isActive: boolean) {
  try {
    const { supabase } = await getAuthenticatedUser();

    const { error } = await supabase
      .from('task_templates')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      logSupabaseError(error, 'toggleTaskTemplateAction');
      return { error: getSupabaseErrorMessage(error, 'Plantilla') };
    }

    revalidatePath('/configuracion');
    return { success: true };
  } catch (err) {
    console.error('toggleTaskTemplateAction error:', err);
    return { error: 'Error inesperado al cambiar el estado de la plantilla' };
  }
}

// -------------------------------------------------------
// resetDefaultTemplatesAction
// -------------------------------------------------------

export async function resetDefaultTemplatesAction() {
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

    // Delete all templates for this org
    const { error: deleteError } = await supabase
      .from('task_templates')
      .delete()
      .eq('organization_id', profile.organization_id);

    if (deleteError) {
      logSupabaseError(deleteError, 'resetDefaultTemplatesAction');
      return { error: getSupabaseErrorMessage(deleteError, 'Plantilla') };
    }

    // Re-seed defaults via RPC
    const { error: rpcError } = await supabase.rpc('seed_default_task_templates');

    if (rpcError) {
      logSupabaseError(rpcError, 'resetDefaultTemplatesAction');
      return { error: getSupabaseErrorMessage(rpcError, 'Plantilla') };
    }

    revalidatePath('/configuracion');
    return { success: true };
  } catch (err) {
    console.error('resetDefaultTemplatesAction error:', err);
    return { error: 'Error inesperado al restaurar las plantillas' };
  }
}
