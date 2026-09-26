'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  expenseSchema,
  otherRevenueSchema,
  budgetSchema,
  type ExpenseInput,
  type OtherRevenueInput,
  type BudgetInput,
} from '@/lib/validations/finance';

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

async function getUserProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();
  if (error || !profile) throw new Error('Perfil no encontrado');
  return profile;
}

// -------------------------------------------------------
// createExpenseAction
// -------------------------------------------------------

export async function createExpenseAction(formData: ExpenseInput) {
  const parsed = expenseSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const { supabase, user } = await getAuthenticatedUser();
    const profile = await getUserProfile(supabase, user.id);

    const { categoryId, supplier, description, amount, taxAmount, expenseDate, paymentStatus, dueDate } =
      parsed.data;

    const { error } = await supabase.from('expenses').insert({
      organization_id: profile.organization_id,
      category_id: categoryId,
      supplier: supplier ?? null,
      description,
      amount,
      tax_amount: taxAmount,
      expense_date: expenseDate,
      payment_status: paymentStatus,
      due_date: dueDate ?? null,
      created_by: user.id,
    });

    if (error) {
      console.error('createExpenseAction error:', error);
      return { error: 'Error al registrar el gasto' };
    }

    revalidatePath('/finanzas');
    revalidatePath('/finanzas/gastos');
    return { success: true };
  } catch (err) {
    console.error('createExpenseAction error:', err);
    return { error: 'Error inesperado al registrar el gasto' };
  }
}

// -------------------------------------------------------
// updateExpenseAction
// -------------------------------------------------------

export async function updateExpenseAction(id: string, formData: ExpenseInput) {
  const parsed = expenseSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const { supabase } = await getAuthenticatedUser();

    const { categoryId, supplier, description, amount, taxAmount, expenseDate, paymentStatus, dueDate } =
      parsed.data;

    const { error } = await supabase
      .from('expenses')
      .update({
        category_id: categoryId,
        supplier: supplier ?? null,
        description,
        amount,
        tax_amount: taxAmount,
        expense_date: expenseDate,
        payment_status: paymentStatus,
        due_date: dueDate ?? null,
      })
      .eq('id', id);

    if (error) {
      console.error('updateExpenseAction error:', error);
      return { error: 'Error al actualizar el gasto' };
    }

    revalidatePath('/finanzas');
    revalidatePath('/finanzas/gastos');
    return { success: true };
  } catch (err) {
    console.error('updateExpenseAction error:', err);
    return { error: 'Error inesperado al actualizar el gasto' };
  }
}

// -------------------------------------------------------
// deleteExpenseAction
// -------------------------------------------------------

export async function deleteExpenseAction(id: string) {
  try {
    const { supabase } = await getAuthenticatedUser();

    const { error } = await supabase.from('expenses').delete().eq('id', id);

    if (error) {
      console.error('deleteExpenseAction error:', error);
      return { error: 'Error al eliminar el gasto' };
    }

    revalidatePath('/finanzas');
    revalidatePath('/finanzas/gastos');
    return { success: true };
  } catch (err) {
    console.error('deleteExpenseAction error:', err);
    return { error: 'Error inesperado al eliminar el gasto' };
  }
}

// -------------------------------------------------------
// createOtherRevenueAction
// -------------------------------------------------------

export async function createOtherRevenueAction(formData: OtherRevenueInput) {
  const parsed = otherRevenueSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const { supabase, user } = await getAuthenticatedUser();
    const profile = await getUserProfile(supabase, user.id);

    const { revenueCenterId, description, amount, taxAmount, revenueDate } = parsed.data;

    const { error } = await supabase.from('other_revenue').insert({
      organization_id: profile.organization_id,
      revenue_center_id: revenueCenterId,
      description,
      amount,
      tax_amount: taxAmount,
      revenue_date: revenueDate,
      created_by: user.id,
    });

    if (error) {
      console.error('createOtherRevenueAction error:', error);
      return { error: 'Error al registrar el ingreso' };
    }

    revalidatePath('/finanzas');
    revalidatePath('/finanzas/ingresos');
    return { success: true };
  } catch (err) {
    console.error('createOtherRevenueAction error:', err);
    return { error: 'Error inesperado al registrar el ingreso' };
  }
}

// -------------------------------------------------------
// deleteOtherRevenueAction
// -------------------------------------------------------

export async function deleteOtherRevenueAction(id: string) {
  try {
    const { supabase } = await getAuthenticatedUser();

    const { error } = await supabase.from('other_revenue').delete().eq('id', id);

    if (error) {
      console.error('deleteOtherRevenueAction error:', error);
      return { error: 'Error al eliminar el ingreso' };
    }

    revalidatePath('/finanzas');
    revalidatePath('/finanzas/ingresos');
    return { success: true };
  } catch (err) {
    console.error('deleteOtherRevenueAction error:', err);
    return { error: 'Error inesperado al eliminar el ingreso' };
  }
}

// -------------------------------------------------------
// saveBudgetAction (upsert by year/month/metric_key)
// -------------------------------------------------------

export async function saveBudgetAction(formData: BudgetInput) {
  const parsed = budgetSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const { supabase, user } = await getAuthenticatedUser();
    const profile = await getUserProfile(supabase, user.id);

    const { year, month, metricKey, amount } = parsed.data;

    const { error } = await supabase.from('budgets').upsert(
      {
        organization_id: profile.organization_id,
        year,
        month,
        metric_key: metricKey,
        amount,
      },
      { onConflict: 'organization_id,year,month,metric_key' },
    );

    if (error) {
      console.error('saveBudgetAction error:', error);
      return { error: 'Error al guardar el presupuesto' };
    }

    revalidatePath('/finanzas');
    revalidatePath('/finanzas/presupuesto');
    revalidatePath('/finanzas/pyg');
    return { success: true };
  } catch (err) {
    console.error('saveBudgetAction error:', err);
    return { error: 'Error inesperado al guardar el presupuesto' };
  }
}
