'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('No autenticado');
  return { supabase, user };
}

function revalidateHousekeeping() {
  revalidatePath('/limpieza');
  revalidatePath('/hotel');
}

// -------------------------------------------------------
// Start cleaning
// -------------------------------------------------------

export async function startCleaningAction(cleaningId: string) {
  try {
    const { supabase } = await getAuthenticatedUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('start_cleaning', {
      p_cleaning_id: cleaningId,
    });
    if (error) {
      logSupabaseError(error, 'startCleaningAction');
      return { error: getSupabaseErrorMessage(error) };
    }
    revalidateHousekeeping();
    return { success: true, ...(data as object) };
  } catch (err) {
    console.error('startCleaningAction error:', err);
    return { error: 'Error inesperado al iniciar la limpieza' };
  }
}

// -------------------------------------------------------
// Complete cleaning
// -------------------------------------------------------

export async function completeCleaningAction(
  cleaningId: string,
  data: {
    notes?: string;
    issuesFound?: boolean;
    issueDescription?: string;
    minibarCharged?: boolean;
    checklist?: { text: string; done: boolean }[];
  },
) {
  try {
    const { supabase } = await getAuthenticatedUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (supabase.rpc as any)('complete_cleaning', {
      p_cleaning_id: cleaningId,
      p_notes: data.notes ?? null,
      p_issues_found: data.issuesFound ?? false,
      p_issue_description: data.issueDescription ?? null,
      p_minibar_charged: data.minibarCharged ?? false,
      p_checklist: data.checklist ? JSON.stringify(data.checklist) : null,
    });
    if (error) {
      logSupabaseError(error, 'completeCleaningAction');
      return { error: getSupabaseErrorMessage(error) };
    }
    revalidateHousekeeping();
    return { success: true, ...(result as object) };
  } catch (err) {
    console.error('completeCleaningAction error:', err);
    return { error: 'Error inesperado al completar la limpieza' };
  }
}

// -------------------------------------------------------
// Skip cleaning
// -------------------------------------------------------

export async function skipCleaningAction(
  cleaningId: string,
  reason: string,
  note?: string,
) {
  try {
    const { supabase } = await getAuthenticatedUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('skip_cleaning', {
      p_cleaning_id: cleaningId,
      p_reason: reason,
      p_note: note ?? null,
    });
    if (error) {
      logSupabaseError(error, 'skipCleaningAction');
      return { error: getSupabaseErrorMessage(error) };
    }
    revalidateHousekeeping();
    return { success: true, ...(data as object) };
  } catch (err) {
    console.error('skipCleaningAction error:', err);
    return { error: 'Error inesperado al omitir la limpieza' };
  }
}

// -------------------------------------------------------
// Inspect cleaning
// -------------------------------------------------------

export async function inspectCleaningAction(
  cleaningId: string,
  approved: boolean,
  notes?: string,
) {
  try {
    const { supabase } = await getAuthenticatedUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('inspect_cleaning', {
      p_cleaning_id: cleaningId,
      p_approved: approved,
      p_notes: notes ?? null,
    });
    if (error) {
      logSupabaseError(error, 'inspectCleaningAction');
      return { error: getSupabaseErrorMessage(error) };
    }
    revalidateHousekeeping();
    return { success: true, ...(data as object) };
  } catch (err) {
    console.error('inspectCleaningAction error:', err);
    return { error: 'Error inesperado al inspeccionar la limpieza' };
  }
}

// -------------------------------------------------------
// Request cleaning (from reception)
// -------------------------------------------------------

export async function requestCleaningAction(
  roomId: string,
  cleaningTypeId: string,
  scheduledFor: string,
) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) return { error: 'Perfil no encontrado' };

    const { data: role } = await supabase
      .from('roles')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('system_key', 'room_attendant')
      .maybeSingle();

    // Find current stay for this room
    const { data: stay } = await supabase
      .from('stays')
      .select('id')
      .eq('room_id', roomId)
      .eq('status', 'checked_in')
      .maybeSingle();

    const { error } = await supabase.from('room_cleanings').insert({
      organization_id: profile.organization_id,
      room_id: roomId,
      stay_id: stay?.id ?? null,
      cleaning_type_id: cleaningTypeId,
      scheduled_for: scheduledFor,
      origin: 'guest_request',
      assigned_role_id: role?.id ?? null,
      created_by: user.id,
    });

    if (error) {
      logSupabaseError(error, 'requestCleaningAction');
      return { error: getSupabaseErrorMessage(error) };
    }

    revalidateHousekeeping();
    return { success: true };
  } catch (err) {
    console.error('requestCleaningAction error:', err);
    return { error: 'Error inesperado al solicitar la limpieza' };
  }
}

// -------------------------------------------------------
// Schedule cleaning (multi-room)
// -------------------------------------------------------

export async function scheduleCleaningAction(data: {
  roomIds: string[];
  cleaningTypeId: string;
  scheduledFor: string;
  assignedTo?: string;
  priority?: string;
  instructions?: string;
  replaceWeekly?: boolean;
}) {
  try {
    const { supabase } = await getAuthenticatedUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (supabase.rpc as any)('create_manual_cleaning', {
      p_room_ids: data.roomIds,
      p_cleaning_type_id: data.cleaningTypeId,
      p_scheduled_for: data.scheduledFor,
      p_assigned_to: data.assignedTo ?? null,
      p_priority: data.priority ?? 'normal',
      p_instructions: data.instructions ?? null,
      p_replace_weekly: data.replaceWeekly ?? false,
    });
    if (error) {
      logSupabaseError(error, 'scheduleCleaningAction');
      return { error: getSupabaseErrorMessage(error) };
    }
    revalidateHousekeeping();
    return { success: true, ...(result as object) };
  } catch (err) {
    console.error('scheduleCleaningAction error:', err);
    return { error: 'Error inesperado al programar la limpieza' };
  }
}

// -------------------------------------------------------
// Edit cleaning
// -------------------------------------------------------

export async function editCleaningAction(
  cleaningId: string,
  data: { scheduledFor?: string; cleaningTypeId?: string; assignedTo?: string; notes?: string },
) {
  try {
    const { supabase } = await getAuthenticatedUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('update_cleaning', {
      p_cleaning_id: cleaningId,
      p_scheduled_for: data.scheduledFor ?? null,
      p_cleaning_type_id: data.cleaningTypeId ?? null,
      p_assigned_to: data.assignedTo ?? null,
      p_notes: data.notes ?? null,
    });
    if (error) {
      logSupabaseError(error, 'editCleaningAction');
      return { error: getSupabaseErrorMessage(error) };
    }
    revalidateHousekeeping();
    return { success: true };
  } catch (err) {
    console.error('editCleaningAction error:', err);
    return { error: 'Error inesperado al editar la limpieza' };
  }
}

// -------------------------------------------------------
// Cancel cleaning
// -------------------------------------------------------

export async function cancelCleaningAction(cleaningId: string, reason?: string) {
  try {
    const { supabase } = await getAuthenticatedUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('cancel_cleaning', {
      p_cleaning_id: cleaningId,
      p_reason: reason ?? null,
    });
    if (error) {
      logSupabaseError(error, 'cancelCleaningAction');
      return { error: getSupabaseErrorMessage(error) };
    }
    revalidateHousekeeping();
    return { success: true };
  } catch (err) {
    console.error('cancelCleaningAction error:', err);
    return { error: 'Error inesperado al cancelar la limpieza' };
  }
}

// -------------------------------------------------------
// Register past cleaning
// -------------------------------------------------------

export async function registerPastCleaningAction(data: {
  roomId: string;
  cleaningTypeId: string;
  startedAt: string;
  completedAt: string;
  completedBy?: string;
  notes?: string;
}) {
  try {
    const { supabase } = await getAuthenticatedUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (supabase.rpc as any)('register_past_cleaning', {
      p_room_id: data.roomId,
      p_cleaning_type_id: data.cleaningTypeId,
      p_started_at: data.startedAt,
      p_completed_at: data.completedAt,
      p_completed_by: data.completedBy ?? null,
      p_notes: data.notes ?? null,
    });
    if (error) {
      logSupabaseError(error, 'registerPastCleaningAction');
      return { error: getSupabaseErrorMessage(error) };
    }
    revalidateHousekeeping();
    return { success: true, ...(result as object) };
  } catch (err) {
    console.error('registerPastCleaningAction error:', err);
    return { error: 'Error inesperado al registrar la limpieza' };
  }
}

// -------------------------------------------------------
// Update housekeeping config
// -------------------------------------------------------

export async function updateHousekeepingConfigAction(data: {
  frequencyDays: number;
  defaultTime: string;
  requireInspection: boolean;
  skipPreArrivalHours: number;
  vacantRefreshDays: number;
}) {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile) return { error: 'Perfil no encontrado' };

    const { error } = await supabase.from('housekeeping_config').upsert({
      organization_id: profile.organization_id,
      frequency_days: data.frequencyDays,
      default_time: data.defaultTime,
      require_inspection: data.requireInspection,
      skip_pre_arrival_hours: data.skipPreArrivalHours,
      vacant_refresh_days: data.vacantRefreshDays,
    });

    if (error) {
      logSupabaseError(error, 'updateHousekeepingConfigAction');
      return { error: getSupabaseErrorMessage(error) };
    }

    revalidateHousekeeping();
    return { success: true };
  } catch (err) {
    console.error('updateHousekeepingConfigAction error:', err);
    return { error: 'Error inesperado al guardar la configuración' };
  }
}
