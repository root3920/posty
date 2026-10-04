'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';
import {
  createTaskSchema,
  updateTaskSchema,
  createCommentSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@/lib/validations/tasks';

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
// createTaskAction
// -------------------------------------------------------

export async function createTaskAction(formData: CreateTaskInput) {
  const parsed = createTaskSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

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

    const {
      title,
      description,
      statusId,
      priority,
      assigneeIds,
      dueDate,
      startDate,
      parentTaskId,
      roomId,
      estimatedMinutes,
      labelIds,
    } = parsed.data;

    // Insert task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        organization_id: profile.organization_id,
        title,
        description: description ?? null,
        status_id: statusId,
        priority: priority ?? 'normal',
        created_by: user.id,
        due_date: dueDate || null,
        start_date: startDate || null,
        parent_task_id: parentTaskId || null,
        room_id: roomId || null,
        estimated_minutes: estimatedMinutes ?? null,
      })
      .select('id')
      .single();

    if (taskError || !task) {
      logSupabaseError(taskError, 'createTaskAction');
      return { error: getSupabaseErrorMessage(taskError, 'Tarea') };
    }

    const taskId = task.id;

    // Insert assignees
    if (assigneeIds.length > 0) {
      const { error: assigneeError } = await supabase
        .from('task_assignees')
        .insert(assigneeIds.map((profileId) => ({ task_id: taskId, profile_id: profileId })));

      if (assigneeError) {
        console.error('Error inserting assignees:', assigneeError);
      }
    }

    // Insert label links
    if (labelIds.length > 0) {
      const { error: labelError } = await supabase
        .from('task_label_links')
        .insert(labelIds.map((labelId) => ({ task_id: taskId, label_id: labelId })));

      if (labelError) {
        console.error('Error inserting labels:', labelError);
      }
    }

    revalidatePath('/tareas');
    return { success: true, taskId };
  } catch (err) {
    console.error('createTaskAction error:', err);
    return { error: 'Error inesperado al crear la tarea' };
  }
}

// -------------------------------------------------------
// updateTaskAction
// -------------------------------------------------------

export async function updateTaskAction(taskId: string, formData: UpdateTaskInput) {
  const parsed = updateTaskSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const { supabase } = await getAuthenticatedUser();

    const {
      title,
      description,
      statusId,
      priority,
      assigneeIds,
      dueDate,
      startDate,
      parentTaskId,
      roomId,
      estimatedMinutes,
      labelIds,
    } = parsed.data;

    // Build update payload — only include defined fields
    const updatePayload: {
      title?: string;
      description?: string | null;
      status_id?: string;
      priority?: 'urgent' | 'high' | 'normal' | 'low';
      due_date?: string | null;
      start_date?: string | null;
      parent_task_id?: string | null;
      room_id?: string | null;
      estimated_minutes?: number | null;
    } = {};
    if (title !== undefined) updatePayload.title = title;
    if (description !== undefined) updatePayload.description = description ?? null;
    if (statusId !== undefined) updatePayload.status_id = statusId;
    if (priority !== undefined) updatePayload.priority = priority;
    if (dueDate !== undefined) updatePayload.due_date = dueDate ?? null;
    if (startDate !== undefined) updatePayload.start_date = startDate ?? null;
    if (parentTaskId !== undefined) updatePayload.parent_task_id = parentTaskId ?? null;
    if (roomId !== undefined) updatePayload.room_id = roomId ?? null;
    if (estimatedMinutes !== undefined)
      updatePayload.estimated_minutes = estimatedMinutes ?? null;

    if (Object.keys(updatePayload).length > 0) {
      const { error: taskError } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', taskId);

      if (taskError) {
        logSupabaseError(taskError, 'updateTaskAction');
        return { error: getSupabaseErrorMessage(taskError, 'Tarea') };
      }
    }

    // Update assignees if provided
    if (assigneeIds !== undefined) {
      await supabase.from('task_assignees').delete().eq('task_id', taskId);
      if (assigneeIds.length > 0) {
        await supabase
          .from('task_assignees')
          .insert(assigneeIds.map((profileId) => ({ task_id: taskId, profile_id: profileId })));
      }
    }

    // Update labels if provided
    if (labelIds !== undefined) {
      await supabase.from('task_label_links').delete().eq('task_id', taskId);
      if (labelIds.length > 0) {
        await supabase
          .from('task_label_links')
          .insert(labelIds.map((labelId) => ({ task_id: taskId, label_id: labelId })));
      }
    }

    revalidatePath('/tareas');
    return { success: true };
  } catch (err) {
    console.error('updateTaskAction error:', err);
    return { error: 'Error inesperado al actualizar la tarea' };
  }
}

// -------------------------------------------------------
// deleteTaskAction (soft delete)
// -------------------------------------------------------

export async function deleteTaskAction(taskId: string) {
  try {
    const { supabase } = await getAuthenticatedUser();

    const { error } = await supabase
      .from('tasks')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      logSupabaseError(error, 'deleteTaskAction');
      return { error: getSupabaseErrorMessage(error, 'Tarea') };
    }

    revalidatePath('/tareas');
    return { success: true };
  } catch (err) {
    console.error('deleteTaskAction error:', err);
    return { error: 'Error inesperado al eliminar la tarea' };
  }
}

// -------------------------------------------------------
// addCommentAction
// -------------------------------------------------------

export async function addCommentAction(taskId: string, body: string) {
  const parsed = createCommentSchema.safeParse({ body });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { data: comment, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        author_id: user.id,
        body: parsed.data.body,
      })
      .select('id')
      .single();

    if (error || !comment) {
      logSupabaseError(error, 'addCommentAction');
      return { error: getSupabaseErrorMessage(error, 'Comentario') };
    }

    revalidatePath('/tareas');
    return { success: true, commentId: comment.id };
  } catch (err) {
    console.error('addCommentAction error:', err);
    return { error: 'Error inesperado al agregar el comentario' };
  }
}

// -------------------------------------------------------
// updateTaskStatusAction (quick status change for kanban)
// -------------------------------------------------------

export async function updateTaskStatusAction(taskId: string, statusId: string) {
  try {
    const { supabase } = await getAuthenticatedUser();

    const { error } = await supabase
      .from('tasks')
      .update({ status_id: statusId })
      .eq('id', taskId);

    if (error) {
      logSupabaseError(error, 'updateTaskStatusAction');
      return { error: getSupabaseErrorMessage(error, 'Tarea') };
    }

    revalidatePath('/tareas');
    return { success: true };
  } catch (err) {
    console.error('updateTaskStatusAction error:', err);
    return { error: 'Error inesperado al actualizar el estado' };
  }
}
