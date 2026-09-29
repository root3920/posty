'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('No autenticado');
  return { supabase, user };
}

function revalidate() {
  revalidatePath('/configuracion/automatizaciones');
}

// -------------------------------------------------------
// Create automation
// -------------------------------------------------------

export async function createAutomationAction(data: {
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
}) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile) return { error: 'Perfil no encontrado' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: automation, error } = await (supabase.from('automations').insert as any)({
      organization_id: profile.organization_id,
      name: data.name,
      description: data.description ?? null,
      trigger_type: data.triggerType,
      trigger_config: data.triggerConfig ?? {},
      is_active: false,
      created_by: user.id,
    }).select('id').single();

    if (error) {
      logSupabaseError(error, 'createAutomationAction');
      return { error: getSupabaseErrorMessage(error) };
    }

    revalidate();
    return { success: true, automationId: automation.id };
  } catch (err) {
    console.error('createAutomationAction error:', err);
    return { error: 'Error inesperado al crear la automatización' };
  }
}

// -------------------------------------------------------
// Update automation
// -------------------------------------------------------

export async function updateAutomationAction(id: string, data: {
  name?: string;
  description?: string;
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  conditions?: unknown;
  isActive?: boolean;
}) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const payload: Record<string, unknown> = { updated_by: user.id };
    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.triggerType !== undefined) payload.trigger_type = data.triggerType;
    if (data.triggerConfig !== undefined) payload.trigger_config = data.triggerConfig;
    if (data.conditions !== undefined) payload.conditions = data.conditions;
    if (data.isActive !== undefined) payload.is_active = data.isActive;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('automations').update as any)(payload).eq('id', id);
    if (error) {
      logSupabaseError(error, 'updateAutomationAction');
      return { error: getSupabaseErrorMessage(error) };
    }

    revalidate();
    return { success: true };
  } catch (err) {
    console.error('updateAutomationAction error:', err);
    return { error: 'Error inesperado al actualizar la automatización' };
  }
}

// -------------------------------------------------------
// Delete automation
// -------------------------------------------------------

export async function deleteAutomationAction(id: string) {
  try {
    const { supabase } = await getAuthenticatedUser();
    const { error } = await supabase.from('automations').delete().eq('id', id).eq('is_system', false);
    if (error) {
      logSupabaseError(error, 'deleteAutomationAction');
      return { error: getSupabaseErrorMessage(error) };
    }
    revalidate();
    return { success: true };
  } catch (err) {
    console.error('deleteAutomationAction error:', err);
    return { error: 'Error inesperado al eliminar la automatización' };
  }
}

// -------------------------------------------------------
// Add step
// -------------------------------------------------------

export async function addStepAction(automationId: string, data: {
  position: number;
  actionType: string;
  actionConfig: Record<string, unknown>;
  parentStepId?: string;
  branch?: string;
}) {
  try {
    const { supabase } = await getAuthenticatedUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: step, error } = await (supabase.from('automation_steps').insert as any)({
      automation_id: automationId,
      position: data.position,
      action_type: data.actionType,
      action_config: data.actionConfig,
      parent_step_id: data.parentStepId ?? null,
      branch: data.branch ?? null,
    }).select('id').single();

    if (error) {
      logSupabaseError(error, 'addStepAction');
      return { error: getSupabaseErrorMessage(error) };
    }
    revalidate();
    return { success: true, stepId: step.id };
  } catch (err) {
    console.error('addStepAction error:', err);
    return { error: 'Error inesperado al agregar el paso' };
  }
}

// -------------------------------------------------------
// Toggle active
// -------------------------------------------------------

export async function toggleAutomationAction(id: string, isActive: boolean) {
  return updateAutomationAction(id, { isActive });
}
