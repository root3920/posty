'use client';

import { useState, Suspense, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFinanceKPIs, useBudgets } from '@/hooks/use-finance';
import { PylTable, buildUsaliRows, type UsaliBudgets } from '@/components/finanzas/pyl-table';

// -------------------------------------------------------
// PygContent
// -------------------------------------------------------

function PygContent() {
  const today = new Date();
  const [monthDate, setMonthDate] = useState(startOfMonth(today));

  const periodFrom = format(monthDate, 'yyyy-MM-dd');
  const periodTo = format(endOfMonth(monthDate), 'yyyy-MM-dd');

  const { data: kpis, isLoading: kpisLoading } = useFinanceKPIs({
    from: periodFrom,
    to: periodTo,
  });

  const currentYear = monthDate.getFullYear();
  const currentMonth = monthDate.getMonth() + 1;

  const { data: budgets = [] } = useBudgets(currentYear);

  // Build budgets lookup for this month
  const monthBudgets = useMemo((): UsaliBudgets => {
    const result: UsaliBudgets = {};
    for (const b of budgets) {
      if (b.month !== currentMonth) continue;
      const key = b.metric_key as keyof UsaliBudgets;
      result[key] = b.amount;
    }
    return result;
  }, [budgets, currentMonth]);

  // Build USALI rows
  const pylRows = useMemo(() => {
    if (!kpis) return [];

    return buildUsaliRows(
      {
        revenueByCenter: kpis.revenueByCenter,
        totalRevenue: kpis.totalRevenue,
        departmentalExpenses: kpis.departmentalExpenses,
        undistributedExpenses: kpis.undistributedExpenses,
        payrollExpenses: kpis.payrollExpenses,
        fixedExpenses: kpis.fixedExpenses,
        totalExpenses: kpis.totalExpenses,
        gop: kpis.gop,
        gopMarginPct: kpis.gopMarginPct,
        ebitda: kpis.ebitda,
        netProfit: kpis.netProfit,
      },
      monthBudgets,
    );
  }, [kpis, monthBudgets]);

  const monthLabel = format(monthDate, 'MMMM yyyy', { locale: es });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Estado de Resultados (P&G)</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Formato USALI — Real vs. Presupuesto
            </p>
          </div>

          {/* Month navigator */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setMonthDate((d) => subMonths(d, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold capitalize min-w-[140px] text-center">
              {monthLabel}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setMonthDate((d) => addMonths(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        {kpisLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground text-sm">Cargando datos...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary cards */}
            {kpis && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-2">
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">Ingresos Totales</p>
                  <p className="text-lg font-bold text-indigo-600">
                    {new Intl.NumberFormat('es-CO', {
                      style: 'currency',
                      currency: 'COP',
                      minimumFractionDigits: 0,
                    }).format(kpis.totalRevenue)}
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">GOP</p>
                  <p className={`text-lg font-bold ${kpis.gop >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {new Intl.NumberFormat('es-CO', {
                      style: 'currency',
                      currency: 'COP',
                      minimumFractionDigits: 0,
                    }).format(kpis.gop)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Margen: {kpis.gopMarginPct.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">EBITDA</p>
                  <p className={`text-lg font-bold ${kpis.ebitda >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                    {new Intl.NumberFormat('es-CO', {
                      style: 'currency',
                      currency: 'COP',
                      minimumFractionDigits: 0,
                    }).format(kpis.ebitda)}
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">Resultado Neto</p>
                  <p className={`text-lg font-bold ${kpis.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {new Intl.NumberFormat('es-CO', {
                      style: 'currency',
                      currency: 'COP',
                      minimumFractionDigits: 0,
                    }).format(kpis.netProfit)}
                  </p>
                </div>
              </div>
            )}

            {/* P&L Table */}
            <PylTable
              rows={pylRows}
              title={`Estado de Resultados — ${monthLabel}`}
            />

            {/* Notes */}
            <p className="text-xs text-muted-foreground">
              * Las variaciones en verde indican resultado favorable (más ingresos o menos gastos que presupuesto).
              Las variaciones en rojo indican resultado desfavorable.
              El presupuesto se configura en la sección{' '}
              <a href="/finanzas/presupuesto" className="underline hover:text-foreground">
                Presupuesto
              </a>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PygPage() {
  return (
    <Suspense>
      <PygContent />
    </Suspense>
  );
}
