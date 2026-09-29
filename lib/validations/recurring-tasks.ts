import { z } from 'zod';

export const recurringTaskSchema = z.object({
  title: z.string().min(1, 'El titulo es obligatorio'),
  description: z.string().optional().default(''),
  subtasks: z.array(z.object({ text: z.string() })).default([]),
  assigned_role_id: z.string().uuid().nullable().optional(),
  assigned_profile_id: z.string().uuid().nullable().optional(),
  room_id: z.string().uuid().nullable().optional(),
  frequency_type: z.enum(['daily', 'weekly', 'monthly_day', 'every_n_days']),
  frequency_config: z.record(z.any()).default({}),
  at_time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
});

export type RecurringTaskInput = z.infer<typeof recurringTaskSchema>;
