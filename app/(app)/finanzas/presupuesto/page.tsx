'use client';

import { useState, Suspense, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useBudgets } from '@/hooks/use-finance';
import { saveBudgetAction } from '@/app/actions/finance';
import { formatCurrency } from '@/lib/format';

// -------------------------------------------------------
// Metric definitions
// -------------------------------------------------------

interface MetricDef {
  key: string;
  label: string;
  description: string;
  format: 'currency' | 'percent' | 'number';
  group: string;
}

const METRICS: MetricDef[] = [
  // Revenue
  { key: 'revenue_total', label: 'Ingresos Totales', description: 'Total de ingresos del mes', format: 'currency', group: 'Ingresos' },
  { key: 'revenue_rooms', label: 'Ingresos Habitaciones', description: 'Ingresos por tarifas de habitación', format: 'currency', group: 'Ingresos' },
  { key: 'revenue_food', label: 'Alimentos & Bebidas', description: 'Ingresos F&B', format: 'currency', group: 'Ingresos' },
  { key: 'revenue_other', label: 'Otros Ingresos', description: 'Otros centros de ingresos', format: 'currency', group: 'Ingresos' },
  // Occupancy
  { key: 'occupancy', label: 'Ocupación %', description: 'Porcentaje de ocupación objetivo', format: 'percent', group: 'Operación' },
  { key: 'adr', label: 'ADR', description: 'Tarifa promedio diaria objetivo', format: 'currency', group: 'Operación' },
  { key: 'revpar', label: 'RevPAR', description: 'Ingresos por habitación disponible', format: 'currency', group: 'Operación' },
  { key: 'room_nights', label: 'Noches Vendidas', description: 'Total noches vendidas presupuestadas', format: 'number', group: 'Operación' },
  // Expenses
  { key: 'departmental_expenses', label: 'Gastos Departamentales', description: 'Gastos operativos por departamento', format: 'currency', group: 'Gastos' },
  { key: 'undistributed_expenses', label: 'Gastos No Distribuidos', description: 'Administración, ventas, IT, etc.', format: 'currency', group: 'Gastos' },
  { key: 'payroll', label: 'Nómina y Salarios', description: 'Total costos de personal', format: 'currency', group: 'Gastos' },
  { key: 'fixed_expenses', label: 'Gastos Fijos', description: 'Arrendamiento, seguros, depreciación', format: 'currency', group: 'Gastos' },
  // Profitability
  { key: 'gop', label: 'GOP', description: 'Resultado bruto de explotación', format: 'currency', group: 'Rentabilidad' },
  { key: 'ebitda', label: 'EBITDA', description: 'EBITDA mensual', format: 'currency', group: 'Rentabilidad' },
  { key: 'net_profit', label: 'Resultado Neto', description: 'Utilidad neta', format: 'currency', group: 'Rentabilidad' },
  { key: 'gop_margin', label: 'Margen GOP %', description: 'GOP / Ingresos totales × 100', format: 'percent', group: 'Rentabilidad' },
];

const MONTHS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

// -------------------------------------------------------
// Types
// -------------------------------------------------------

type BudgetGrid = Record<string, Record<number, string>>; // metricKey -> month (1-12) -> value string

// -------------------------------------------------------
// PresupuestoContent
// -------------------------------------------------------

function PresupuestoContent() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: budgets = [], isLoading } = useBudgets(year);

  // Local grid state (metricKey -> month -> value)
  const [grid, setGrid] = useState<BudgetGrid>({});

  // Initialize grid from budgets
  useEffect(() => {
    const newGrid: BudgetGrid = {};
    for (const budget of budgets) {
      if (!newGrid[budget.metric_key]) newGrid[budget.metric_key] = {};
      newGrid[budget.metric_key][budget.month] = budget.amount.toString();
    }
    setGrid(newGrid);
    setDirty(false);
  }, [budgets]);

  const handleCellChange = useCallback(
    (metricKey: string, month: number, value: string) => {
      setGrid((prev) => ({
        ...prev,
        [metricKey]: { ...(prev[metricKey] ?? {}), [month]: value },
      }));
      setDirty(true);
    },
    [],
  );

  async function handleSave() {
    setSaving(true);
    const errors: string[] = [];

    for (const metric of METRICS) {
      for (let month = 1; month <= 12; month++) {
        const raw = grid[metric.key]?.[month];
        if (raw == null || raw === '') continue;
        const amount = parseFloat(raw);
        if (isNaN(amount)) {
          errors.push(`Valor inválido para ${metric.label} ${MONTHS[month - 1]}`);
          continue;
        }
        const result = await saveBudgetAction({
          year,
          month,
          metricKey: metric.key,
          amount,
        });
        if (result.error) {
          errors.push(`Error en ${metric.label}: ${result.error}`);
        }
      }
    }

    setSaving(false);
    if (errors.length > 0) {
      toast.error(errors[0]);
    } else {
      toast.success('Presupuesto guardado correctamente');
      queryClient.invalidateQueries({ queryKey: ['finance_budgets', year] });
      setDirty(false);
    }
  }

  // Annual totals per metric
  function getAnnualTotal(metricKey: string): number {
    const monthData = grid[metricKey] ?? {};
    return Object.values(monthData).reduce((sum, v) => {
      const n = parseFloat(v ?? '0');
      return sum + (isNaN(n) ? 0 : n);
    }, 0);
  }

  // Group metrics
  const groupedMetrics = METRICS.reduce<Record<string, MetricDef[]>>((acc, m) => {
    if (!acc[m.group]) acc[m.group] = [];
    acc[m.group].push(m);
    return acc;
  }, {});

  function formatMetricValue(metric: MetricDef, value: number): string {
    if (metric.format === 'currency') return formatCurrency(value);
    if (metric.format === 'percent') return `${value.toFixed(1)}%`;
    return value.toLocaleString('es-CO');
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Presupuesto</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Planificación anual por métricas clave
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Year navigator */}
            <div className="flex items-center gap-1 rounded-lg border bg-background px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setYear((y) => y - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold tabular-nums w-10 text-center">{year}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setYear((y) => y + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button onClick={handleSave} size="sm" disabled={saving || !dirty}>
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-4 w-4" />
                  Guardar cambios
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-background">
                <tr>
                  <th className="border-b border-r px-4 py-3 text-left font-semibold text-sm bg-background min-w-[180px] sticky left-0 z-20">
                    Métrica
                  </th>
                  {MONTHS.map((m, i) => (
                    <th
                      key={i}
                      className="border-b px-3 py-3 text-center font-semibold text-muted-foreground min-w-[100px]"
                    >
                      {m}
                    </th>
                  ))}
                  <th className="border-b border-l px-3 py-3 text-right font-semibold min-w-[110px]">
                    Total Año
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedMetrics).map(([group, metrics]) => (
                  <>
                    {/* Group header */}
                    <tr key={`group-${group}`}>
                      <td
                        colSpan={14}
                        className="border-b bg-muted/30 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground sticky left-0"
                      >
                        {group}
                      </td>
                    </tr>

                    {metrics.map((metric) => {
                      const annualTotal = getAnnualTotal(metric.key);
                      return (
                        <tr key={metric.key} className="hover:bg-muted/20 group">
                          <td className="border-b border-r px-4 py-2 sticky left-0 bg-background group-hover:bg-muted/20 z-10">
                            <div>
                              <p className="font-medium text-sm">{metric.label}</p>
                              <p className="text-[10px] text-muted-foreground">{metric.description}</p>
                            </div>
                          </td>
                          {MONTHS.map((_, monthIdx) => {
                            const month = monthIdx + 1;
                            const value = grid[metric.key]?.[month] ?? '';
                            return (
                              <td key={month} className="border-b px-1 py-1">
                                <input
                                  type="number"
                                  step={metric.format === 'number' ? '1' : '0.01'}
                                  min="0"
                                  value={value}
                                  onChange={(e) =>
                                    handleCellChange(metric.key, month, e.target.value)
                                  }
                                  placeholder="—"
                                  className="w-full rounded border-0 bg-transparent px-2 py-1 text-right text-xs hover:bg-muted/40 focus:bg-muted focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                                />
                              </td>
                            );
                          })}
                          <td className="border-b border-l px-3 py-2 text-right font-semibold tabular-nums">
                            {annualTotal > 0
                              ? formatMetricValue(metric, annualTotal)
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dirty && (
        <div className="border-t bg-amber-50 dark:bg-amber-900/20 px-6 py-2 text-xs text-amber-700 dark:text-amber-300">
          Hay cambios sin guardar. Haz clic en &quot;Guardar cambios&quot; para confirmar.
        </div>
      )}
    </div>
  );
}

export default function PresupuestoPage() {
  return (
    <Suspense>
      <PresupuestoContent />
    </Suspense>
  );
}
