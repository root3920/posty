'use client';

import { useState, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  BedDouble,
  Banknote,
  ArrowUpRight,
  CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiGrid } from '@/components/shared/kpi-grid';
import { useFinanceKPIs, type FinancePeriod } from '@/hooks/use-finance';
import { KpiCard, KpiCardSkeleton } from '@/components/shared/kpi-card';
import { formatCurrency, formatPercent } from '@/lib/format';
import {
  RevenueExpenseChart,
  RevenueByCenterChart,
  RevenueByPaymentChart,
} from '@/components/finanzas/finance-charts';

// -------------------------------------------------------
// Period presets
// -------------------------------------------------------

type PeriodKey = 'hoy' | 'semana' | 'mes' | 'mes_ant' | 'ytd' | 'custom';

interface PeriodPreset {
  key: PeriodKey;
  label: string;
  from: string;
  to: string;
}

function buildPresets(): PeriodPreset[] {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  return [
    {
      key: 'hoy',
      label: 'Hoy',
      from: todayStr,
      to: todayStr,
    },
    {
      key: 'semana',
      label: 'Esta semana',
      from: format(startOfWeek(today, { locale: es }), 'yyyy-MM-dd'),
      to: format(endOfWeek(today, { locale: es }), 'yyyy-MM-dd'),
    },
    {
      key: 'mes',
      label: 'Este mes',
      from: format(startOfMonth(today), 'yyyy-MM-dd'),
      to: format(endOfMonth(today), 'yyyy-MM-dd'),
    },
    {
      key: 'mes_ant',
      label: 'Mes anterior',
      from: format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd'),
      to: format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd'),
    },
    {
      key: 'ytd',
      label: 'Año a la fecha',
      from: format(startOfYear(today), 'yyyy-MM-dd'),
      to: todayStr,
    },
  ];
}

function getPreviousPeriod(from: string, to: string): FinancePeriod {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
  return {
    from: format(subDays(fromDate, days), 'yyyy-MM-dd'),
    to: format(subDays(toDate, days), 'yyyy-MM-dd'),
  };
}

function calcChangePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// -------------------------------------------------------
// Main content
// -------------------------------------------------------

function FinanzasContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const presets = useMemo(() => buildPresets(), []);

  const activePeriodKey = (searchParams.get('periodo') ?? 'mes') as PeriodKey;
  const customFrom = searchParams.get('desde') ?? '';
  const customTo = searchParams.get('hasta') ?? '';

  const activePeriod = useMemo((): FinancePeriod => {
    if (activePeriodKey === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    const preset = presets.find((p) => p.key === activePeriodKey) ?? presets[2];
    return { from: preset.from, to: preset.to };
  }, [activePeriodKey, customFrom, customTo, presets]);

  const prevPeriod = useMemo(() => getPreviousPeriod(activePeriod.from, activePeriod.to), [activePeriod]);

  const { data: kpis, isLoading: kpisLoading } = useFinanceKPIs(activePeriod);
  const { data: prevKpis } = useFinanceKPIs(prevPeriod);

  // Custom range pickers
  const [customFromInput, setCustomFromInput] = useState(customFrom);
  const [customToInput, setCustomToInput] = useState(customTo);

  function updatePeriod(key: PeriodKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('periodo', key);
    if (key !== 'custom') {
      params.delete('desde');
      params.delete('hasta');
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyCustomRange() {
    if (!customFromInput || !customToInput) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('periodo', 'custom');
    params.set('desde', customFromInput);
    params.set('hasta', customToInput);
    router.push(`${pathname}?${params.toString()}`);
  }

  const now = new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finanzas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground capitalize">
            {format(now, "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => router.push('/finanzas/ingresos')}>
            <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
            Ingresos
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/finanzas/gastos')}>
            <DollarSign className="mr-1.5 h-3.5 w-3.5" />
            Gastos
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/finanzas/pyg')}>
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            P&G
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/finanzas/presupuesto')}>
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
            Presupuesto
          </Button>
        </div>
      </div>
        {/* Period selector */}
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((preset) => (
            <button
              key={preset.key}
              onClick={() => updatePeriod(preset.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activePeriodKey === preset.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={() => updatePeriod('custom')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activePeriodKey === 'custom'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Rango personalizado
          </button>

          {activePeriodKey === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={customFromInput}
                onChange={(e) => setCustomFromInput(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-sm"
              />
              <span className="text-muted-foreground text-sm">—</span>
              <input
                type="date"
                value={customToInput}
                onChange={(e) => setCustomToInput(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-sm"
              />
              <Button size="sm" onClick={applyCustomRange}>
                Aplicar
              </Button>
            </div>
          )}
        </div>

        {/* Period label */}
        <p className="text-xs text-muted-foreground -mt-2">
          Período: {activePeriod.from} → {activePeriod.to}
        </p>

        {/* KPI Cards */}
        <KpiGrid>
          {kpisLoading ? (
            [...Array(6)].map((_, i) => <KpiCardSkeleton key={i} />)
          ) : kpis ? (
            <>
              <KpiCard
                icon={<TrendingUp className="h-5 w-5" />}
                label="Ingresos Totales"
                value={kpis.totalRevenue}
                formatValue={(n) => formatCurrency(n)}
                changePct={calcChangePct(kpis.totalRevenue, prevKpis?.totalRevenue ?? 0)}
                formula="Cargos de folio (estancias) + Otros ingresos del período"
              />
              <KpiCard
                icon={<BarChart3 className="h-5 w-5" />}
                label="GOP"
                value={kpis.gop}
                formatValue={(n) => formatCurrency(n)}
                subLabel={`Margen: ${formatPercent(kpis.gopMarginPct)}`}
                changePct={calcChangePct(kpis.gop, prevKpis?.gop ?? 0)}
                formula="GOP = Ingresos − Gastos departamentales − No distribuidos − Nómina. Margen% = GOP / Ingresos × 100"
              />
              <KpiCard
                icon={<BedDouble className="h-5 w-5" />}
                label="Ocupación"
                value={kpis.occupancyPct}
                formatValue={(n) => formatPercent(n)}
                subLabel={`${kpis.roomNightsSold} de ${kpis.roomNightsAvailable} noches`}
                changePct={calcChangePct(kpis.occupancyPct, prevKpis?.occupancyPct ?? 0)}
                formula="Noches vendidas / Noches disponibles × 100"
              />
              <KpiCard
                icon={<DollarSign className="h-5 w-5" />}
                label="ADR"
                value={kpis.adr}
                formatValue={(n) => formatCurrency(n)}
                changePct={calcChangePct(kpis.adr, prevKpis?.adr ?? 0)}
                formula="ADR = Ingresos habitación / Noches vendidas"
              />
              <KpiCard
                icon={<ArrowUpRight className="h-5 w-5" />}
                label="RevPAR"
                value={kpis.revpar}
                formatValue={(n) => formatCurrency(n)}
                changePct={calcChangePct(kpis.revpar, prevKpis?.revpar ?? 0)}
                formula="RevPAR = Ingresos habitación / Noches disponibles"
              />
              <KpiCard
                icon={<Banknote className="h-5 w-5" />}
                label="Flujo de Caja Neto"
                value={kpis.netCashFlow}
                formatValue={(n) => formatCurrency(n)}
                changePct={calcChangePct(kpis.netCashFlow, prevKpis?.netCashFlow ?? 0)}
                formula="Cobros del período − Gastos pagados del período"
              />
            </>
          ) : null}
        </KpiGrid>

        {/* Charts */}
        {kpis && !kpisLoading && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Revenue by center */}
            {kpis.revenueByCenter.length > 0 && (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold">Ingresos por centro</h3>
                <div className="h-[220px] md:h-[320px]">
                  <RevenueByCenterChart data={kpis.revenueByCenter} />
                </div>
              </div>
            )}

            {/* Revenue by payment method */}
            {Object.keys(kpis.cashByPaymentMethod).length > 0 && (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold">Cobros por método de pago</h3>
                <div className="h-[220px] md:h-[320px]">
                  <RevenueByPaymentChart data={kpis.cashByPaymentMethod} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Secondary KPIs */}
        {kpis && !kpisLoading && (
          <KpiGrid>
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="TRevPAR"
              value={kpis.trevpar}
              formatValue={(n) => formatCurrency(n)}
              formula="Ingresos totales / Noches disponibles"
            />
            <KpiCard
              icon={<BedDouble className="h-4 w-4" />}
              label="ALOS"
              value={kpis.alos}
              formatValue={(n) => `${n.toFixed(1)} noches`}
              formula="Noches vendidas / Número de estancias"
            />
            <KpiCard
              icon={<BarChart3 className="h-4 w-4" />}
              label="GOPPAR"
              value={kpis.goppar}
              formatValue={(n) => formatCurrency(n)}
              formula="GOP / Noches disponibles"
            />
            <KpiCard
              icon={<DollarSign className="h-4 w-4" />}
              label="CPOR"
              value={kpis.cpor}
              formatValue={(n) => formatCurrency(n)}
              formula="(Gastos departamentales + No distribuidos) / Noches vendidas"
            />
            <KpiCard
              icon={<Banknote className="h-4 w-4" />}
              label="Cuentas por cobrar"
              value={kpis.accountsReceivable}
              formatValue={(n) => formatCurrency(n)}
              formula="Suma de saldos positivos de estancias activas"
            />
            <KpiCard
              icon={<ArrowUpRight className="h-4 w-4" />}
              label="Cuentas por pagar"
              value={kpis.accountsPayable}
              formatValue={(n) => formatCurrency(n)}
              formula="Suma de gastos con estado 'pendiente'"
            />
          </KpiGrid>
        )}

        {/* Projected revenue */}
        {kpis && !kpisLoading && (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold">Ingresos proyectados (desde hoy)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Próximos 30 días</p>
                <p className="text-lg font-bold text-status-occupancy">
                  {formatCurrency(kpis.projectedRevenue30)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Próximos 60 días</p>
                <p className="text-lg font-bold text-status-arrivals">
                  {formatCurrency(kpis.projectedRevenue60)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Próximos 90 días</p>
                <p className="text-lg font-bold text-success">
                  {formatCurrency(kpis.projectedRevenue90)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Basado en reservas confirmadas y check-ins activos (tarifa × noches)
            </p>
          </div>
        )}
    </div>
  );
}

// -------------------------------------------------------
// Page export
// -------------------------------------------------------

export default function FinanzasPage() {
  return (
    <Suspense>
      <FinanzasContent />
    </Suspense>
  );
}
