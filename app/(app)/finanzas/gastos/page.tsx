'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Trash2, Pencil, SlidersHorizontal, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EntitySelect } from '@/components/shared/entity-select';
import { useExpenses, type ExpenseFilters, type ExpenseWithCategory } from '@/hooks/use-finance';
import { formatCurrency } from '@/lib/format';
import {
  createExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
} from '@/app/actions/finance';
import { expenseSchema, type ExpenseInput } from '@/lib/validations/finance';
import type { Enums } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';

// -------------------------------------------------------
// Category selector hook
// -------------------------------------------------------

function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense_categories'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// -------------------------------------------------------
// GROUP_LABELS
// -------------------------------------------------------

const GROUP_LABELS: Record<string, string> = {
  departmental: 'Departamentales',
  undistributed: 'No distribuidos',
  fixed: 'Fijos',
  payroll: 'Nómina',
};

const STATUS_CONFIG = {
  paid: { label: 'Pagado', icon: CheckCircle, color: 'text-success bg-success/10' },
  pending: { label: 'Pendiente', icon: Clock, color: 'text-warning bg-warning/10' },
};

// -------------------------------------------------------
// Expense Form Modal
// -------------------------------------------------------

interface ExpenseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingExpense?: ExpenseWithCategory | null;
}

function ExpenseFormModal({ open, onClose, onSaved, editingExpense }: ExpenseFormModalProps) {
  const { data: categories = [] } = useExpenseCategories();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<ExpenseInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(expenseSchema) as any,
    defaultValues: editingExpense
      ? {
          categoryId: editingExpense.category_id,
          supplier: editingExpense.supplier ?? undefined,
          description: editingExpense.description,
          amount: editingExpense.amount,
          taxAmount: editingExpense.tax_amount,
          expenseDate: editingExpense.expense_date,
          paymentStatus: editingExpense.payment_status,
          dueDate: editingExpense.due_date ?? undefined,
        }
      : {
          taxAmount: 0,
          paymentStatus: 'pending',
          expenseDate: format(new Date(), 'yyyy-MM-dd'),
        },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function onSubmit(data: any) {
    const typedData = data as ExpenseInput;
    setSaving(true);
    const result = editingExpense
      ? await updateExpenseAction(editingExpense.id, typedData)
      : await createExpenseAction(typedData);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(editingExpense ? 'Gasto actualizado' : 'Gasto registrado');
      reset();
      onSaved();
      onClose();
    }
  }

  if (!open) return null;

  const paymentStatus = watch('paymentStatus');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-bold">
          {editingExpense ? 'Editar gasto' : 'Registrar gasto'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Categoría *</label>
            <EntitySelect
              options={categories.map((cat) => ({
                value: cat.id,
                label: `${cat.name} (${GROUP_LABELS[cat.category_group] ?? cat.category_group})`,
              }))}
              value={watch('categoryId') ?? null}
              onChange={(v) => setValue('categoryId', v ?? '')}
              placeholder="Seleccionar categoría..."
            />
            {errors.categoryId && (
              <p className="mt-1 text-xs text-danger">{errors.categoryId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Proveedor</label>
              <input
                {...register('supplier')}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Ej: Distribuidora XYZ"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Estado *</label>
              <Select
                value={paymentStatus}
                onValueChange={(v) =>
                  setValue('paymentStatus', v as Enums<'payment_status'>)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Descripción *</label>
            <input
              {...register('description')}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Ej: Compra de suministros de limpieza"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-danger">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Monto *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('amount', { valueAsNumber: true })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Impuesto</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('taxAmount', { valueAsNumber: true })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Fecha del gasto *</label>
              <input
                type="date"
                {...register('expenseDate')}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Fecha de vencimiento</label>
              <input
                type="date"
                {...register('dueDate')}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Gastos Content
// -------------------------------------------------------

function GastosContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const filterCategory = searchParams.get('categoria') ?? undefined;
  const filterFrom = searchParams.get('desde') ?? undefined;
  const filterTo = searchParams.get('hasta') ?? undefined;
  const filterStatus = (searchParams.get('estado') ?? undefined) as Enums<'payment_status'> | undefined;

  const filters: ExpenseFilters = {
    from: filterFrom,
    to: filterTo,
    categoryId: filterCategory,
    paymentStatus: filterStatus,
  };

  const { data: expenses = [], isLoading } = useExpenses(filters);
  const { data: categories = [] } = useExpenseCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseWithCategory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return;
    setDeletingId(id);
    const result = await deleteExpenseAction(id);
    setDeletingId(null);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Gasto eliminado');
      queryClient.invalidateQueries({ queryKey: ['finance_expenses'] });
    }
  }

  // Totals by category group
  const totalsByGroup = expenses.reduce<Record<string, number>>((acc, exp) => {
    const group = exp.category?.category_group ?? 'other';
    acc[group] = (acc[group] ?? 0) + exp.amount;
    return acc;
  }, {});

  const grandTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gastos</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Registro y seguimiento de todos los gastos operativos
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingExpense(null);
              setFormOpen(true);
            }}
            size="sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Registrar gasto
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="date"
            value={filterFrom ?? ''}
            onChange={(e) => updateParam('desde', e.target.value || null)}
            className="h-7 rounded-md border bg-background px-2 text-xs"
          />
          <span className="text-muted-foreground text-xs">—</span>
          <input
            type="date"
            value={filterTo ?? ''}
            onChange={(e) => updateParam('hasta', e.target.value || null)}
            className="h-7 rounded-md border bg-background px-2 text-xs"
          />
          <EntitySelect
            options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
            value={filterCategory ?? null}
            onChange={(v) => updateParam('categoria', v)}
            placeholder="Todas las categorías"
            allowClear
            clearLabel="Todas las categorías"
            size="sm"
            triggerClassName="w-44"
          />
          <Select
            value={filterStatus ?? ''}
            onValueChange={(v) => updateParam('estado', v || null)}
          >
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="paid">Pagado</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Totals by group */}
        {Object.keys(totalsByGroup).length > 0 && (
          <div className="flex flex-wrap gap-3">
            {Object.entries(totalsByGroup).map(([group, total]) => (
              <div key={group} className="rounded-lg border bg-card px-4 py-2 text-sm">
                <p className="text-xs text-muted-foreground">{GROUP_LABELS[group] ?? group}</p>
                <p className="font-bold">{formatCurrency(total)}</p>
              </div>
            ))}
            <div className="rounded-lg border bg-destructive/10 px-4 py-2 text-sm">
              <p className="text-xs text-muted-foreground">Total Gastos</p>
              <p className="font-bold text-destructive">{formatCurrency(grandTotal)}</p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="py-2.5 px-4 text-left font-semibold text-muted-foreground">Fecha</th>
                <th className="py-2.5 px-4 text-left font-semibold text-muted-foreground">Categoría</th>
                <th className="py-2.5 px-4 text-left font-semibold text-muted-foreground">Proveedor</th>
                <th className="py-2.5 px-4 text-left font-semibold text-muted-foreground">Descripción</th>
                <th className="py-2.5 px-4 text-right font-semibold text-muted-foreground">Monto</th>
                <th className="py-2.5 px-4 text-center font-semibold text-muted-foreground">Estado</th>
                <th className="py-2.5 px-4 text-right font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-t">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground text-sm">
                    No hay gastos registrados para este período
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => {
                  const statusConf = STATUS_CONFIG[exp.payment_status];
                  const StatusIcon = statusConf.icon;
                  return (
                    <tr key={exp.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(exp.expense_date), 'd MMM yyyy', { locale: es })}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{exp.category?.name ?? '—'}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {GROUP_LABELS[exp.category?.category_group ?? ''] ?? ''}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{exp.supplier ?? '—'}</td>
                      <td className="px-4 py-3">{exp.description}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConf.color}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditingExpense(exp);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-danger"
                            onClick={() => handleDelete(exp.id)}
                            disabled={deletingId === exp.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {expenses.length > 0 && (
              <tfoot>
                <tr className="border-t bg-muted/20">
                  <td colSpan={4} className="px-4 py-2.5 text-sm font-semibold">
                    Total
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                    {formatCurrency(grandTotal)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <ExpenseFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingExpense(null);
        }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['finance_expenses'] })}
        editingExpense={editingExpense}
      />
    </div>
  );
}

export default function GastosPage() {
  return (
    <Suspense>
      <GastosContent />
    </Suspense>
  );
}
