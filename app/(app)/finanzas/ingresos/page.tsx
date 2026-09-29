'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateOnly } from '@/lib/dates';
import { Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EntitySelect } from '@/components/shared/entity-select';
import { useOtherRevenue, type RevenueFilters } from '@/hooks/use-finance';
import { useRevenueCenters } from '@/hooks/use-hotel';
import { formatCurrency } from '@/lib/format';
import { deleteOtherRevenueAction, createOtherRevenueAction } from '@/app/actions/finance';
import { useQueryClient } from '@tanstack/react-query';
import type { OtherRevenueInput } from '@/lib/validations/finance';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { otherRevenueSchema } from '@/lib/validations/finance';

// -------------------------------------------------------
// Create Other Revenue Modal
// -------------------------------------------------------

interface CreateRevenueModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateRevenueModal({ open, onClose, onCreated }: CreateRevenueModalProps) {
  const { data: revenueCenters = [] } = useRevenueCenters();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<OtherRevenueInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(otherRevenueSchema) as any,
    defaultValues: {
      taxAmount: 0,
      revenueDate: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function onSubmit(data: any) {
    const typedData = data as OtherRevenueInput;
    setSaving(true);
    const result = await createOtherRevenueAction(typedData);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Ingreso registrado');
      reset();
      onCreated();
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">Registrar ingreso</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Centro de ingresos *</label>
            <EntitySelect
              options={revenueCenters.map((rc) => ({ value: rc.id, label: rc.name }))}
              value={watch('revenueCenterId') ?? null}
              onChange={(v) => setValue('revenueCenterId', v ?? '')}
              placeholder="Seleccionar..."
            />
            {errors.revenueCenterId && (
              <p className="mt-1 text-xs text-danger">{errors.revenueCenterId.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Descripción *</label>
            <input
              {...register('description')}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Ej: Venta de minibar habitación 201"
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

          <div>
            <label className="mb-1 block text-sm font-medium">Fecha *</label>
            <input
              type="date"
              {...register('revenueDate')}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
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
// Ingresos Content
// -------------------------------------------------------

function IngresosContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const filterCenter = searchParams.get('centro') ?? undefined;
  const filterFrom = searchParams.get('desde') ?? undefined;
  const filterTo = searchParams.get('hasta') ?? undefined;

  const filters: RevenueFilters = {
    from: filterFrom,
    to: filterTo,
    revenueCenterId: filterCenter,
  };

  const { data: revenues = [], isLoading } = useOtherRevenue(filters);
  const { data: revenueCenters = [] } = useRevenueCenters();

  const [createOpen, setCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este ingreso?')) return;
    setDeletingId(id);
    const result = await deleteOtherRevenueAction(id);
    setDeletingId(null);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Ingreso eliminado');
      queryClient.invalidateQueries({ queryKey: ['finance_other_revenue'] });
    }
  }

  // Totals by center
  const totalsByCenter = revenues.reduce<Record<string, { name: string; total: number }>>(
    (acc, rev) => {
      const centerId = rev.revenue_center_id;
      const centerName = rev.revenue_center?.name ?? 'Sin clasificar';
      if (!acc[centerId]) acc[centerId] = { name: centerName, total: 0 };
      acc[centerId].total += rev.amount;
      return acc;
    },
    {},
  );

  const grandTotal = revenues.reduce((sum, rev) => sum + rev.amount, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ingresos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Otros ingresos (no asociados a estancias)
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Registrar ingreso
        </Button>
      </div>
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
            options={revenueCenters.map((rc) => ({ value: rc.id, label: rc.name }))}
            value={filterCenter ?? null}
            onChange={(v) => updateParam('centro', v)}
            placeholder="Todos los centros"
            allowClear
            clearLabel="Todos los centros"
            size="sm"
            triggerClassName="w-44"
          />
        </div>

        {/* Totals by center */}
        {Object.keys(totalsByCenter).length > 0 && (
          <div className="flex flex-wrap gap-3">
            {Object.values(totalsByCenter).map((item) => (
              <div key={item.name} className="rounded-lg border bg-card px-4 py-2 text-sm">
                <p className="text-xs text-muted-foreground">{item.name}</p>
                <p className="font-bold">{formatCurrency(item.total)}</p>
              </div>
            ))}
            <div className="rounded-lg border bg-primary/10 px-4 py-2 text-sm">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-bold text-primary">{formatCurrency(grandTotal)}</p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="py-2.5 px-4 text-left font-semibold text-muted-foreground">Fecha</th>
                <th className="py-2.5 px-4 text-left font-semibold text-muted-foreground">Centro</th>
                <th className="py-2.5 px-4 text-left font-semibold text-muted-foreground">Descripción</th>
                <th className="py-2.5 px-4 text-right font-semibold text-muted-foreground">Monto</th>
                <th className="py-2.5 px-4 text-right font-semibold text-muted-foreground">Impuesto</th>
                <th className="py-2.5 px-4 text-right font-semibold text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-t">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : revenues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                    No hay ingresos registrados para este período
                  </td>
                </tr>
              ) : (
                revenues.map((rev) => (
                  <tr key={rev.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(parseDateOnly(rev.revenue_date), 'd MMM yyyy', { locale: es })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-status-occupancy/10 px-2 py-0.5 text-xs font-medium text-status-occupancy">
                        {rev.revenue_center?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{rev.description}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(rev.amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                      {formatCurrency(rev.tax_amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-danger"
                        onClick={() => handleDelete(rev.id)}
                        disabled={deletingId === rev.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {revenues.length > 0 && (
              <tfoot>
                <tr className="border-t bg-muted/20">
                  <td colSpan={3} className="px-4 py-2.5 text-sm font-semibold">
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

      <CreateRevenueModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['finance_other_revenue'] })}
      />
    </div>
  );
}

export default function IngresosPage() {
  return (
    <Suspense>
      <IngresosContent />
    </Suspense>
  );
}
