import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio').max(255, 'El título es muy largo'),
  description: z.string().optional(),
  statusId: z.string().uuid('Estado inválido'),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).default('normal'),
  assigneeIds: z.array(z.string().uuid()).default([]),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  roomId: z.string().uuid().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  labelIds: z.array(z.string().uuid()).default([]),
});

export const updateTaskSchema = createTaskSchema.partial();

export const createCommentSchema = z.object({
  body: z.string().min(1, 'El comentario no puede estar vacío'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
