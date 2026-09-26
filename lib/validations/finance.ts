import { z } from 'zod';

// -------------------------------------------------------
// Expense schema
// -------------------------------------------------------

export const expenseSchema = z.object({
  categoryId: z.string().uuid('Categoría inválida'),
  supplier: z.string().max(255).nullable().optional(),
  description: z.string().min(1, 'La descripción es obligatoria').max(500),
  amount: z.number().positive('El monto debe ser positivo'),
  taxAmount: z.number().min(0, 'El impuesto no puede ser negativo').default(0),
  expenseDate: z.string().min(1, 'La fecha del gasto es obligatoria'),
  paymentStatus: z.enum(['paid', 'pending']).default('pending'),
  dueDate: z.string().nullable().optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

// -------------------------------------------------------
// Other revenue schema
// -------------------------------------------------------

export const otherRevenueSchema = z.object({
  revenueCenterId: z.string().uuid('Centro de ingresos inválido'),
  description: z.string().min(1, 'La descripción es obligatoria').max(500),
  amount: z.number().positive('El monto debe ser positivo'),
  taxAmount: z.number().min(0, 'El impuesto no puede ser negativo').default(0),
  revenueDate: z.string().min(1, 'La fecha es obligatoria'),
});

export type OtherRevenueInput = z.infer<typeof otherRevenueSchema>;

// -------------------------------------------------------
// Budget schema
// -------------------------------------------------------

export const budgetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  metricKey: z.string().min(1, 'La métrica es obligatoria'),
  amount: z.number().min(0, 'El monto no puede ser negativo'),
});

export type BudgetInput = z.infer<typeof budgetSchema>;
