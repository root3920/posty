'use client';

import { formatCurrency } from '@/lib/format';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface PylRow {
  label: string;
  isHeader?: boolean;
  isTotal?: boolean;
  isSectionTotal?: boolean;
  indent?: number;
  real: number;
  budget: number;
  highlight?: 'positive' | 'negative' | 'neutral';
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function variationAbs(real: number, budget: number): number {
  return real - budget;
}

function variationPct(real: number, budget: number): number | null {
  if (budget === 0) return null;
  return ((real - budget) / Math.abs(budget)) * 100;
}

function fmtPct(val: number | null): string {
  if (val == null) return '—';
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}%`;
}

function variationColor(varAbs: number, isExpense: boolean): string {
  if (varAbs === 0) return 'text-muted-foreground';
  if (isExpense) {
    // For expenses, negative variation (less than budget) is good
    return varAbs < 0 ? 'text-success' : 'text-danger';
  }
  return varAbs > 0 ? 'text-success' : 'text-danger';
}

// -------------------------------------------------------
// PylTable Component
// -------------------------------------------------------

interface PylTableProps {
  rows: PylRow[];
  title?: string;
}

export function PylTable({ rows, title }: PylTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      {title && (
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="py-2.5 px-4 text-left font-semibold text-muted-foreground">
              Concepto
            </th>
            <th className="py-2.5 px-4 text-right font-semibold text-muted-foreground">Real</th>
            <th className="py-2.5 px-4 text-right font-semibold text-muted-foreground">
              Presupuesto
            </th>
            <th className="py-2.5 px-4 text-right font-semibold text-muted-foreground">
              Var. $
            </th>
            <th className="py-2.5 px-4 text-right font-semibold text-muted-foreground">
              Var. %
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const varAbs = variationAbs(row.real, row.budget);
            const varPct = variationPct(row.real, row.budget);
            const isExpense = row.highlight === 'negative';
            const varColor = variationColor(varAbs, isExpense);

            if (row.isHeader) {
              return (
                <tr key={i} className="border-t bg-muted/20">
                  <td
                    colSpan={5}
                    className="py-2 px-4 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                  >
                    {row.label}
                  </td>
                </tr>
              );
            }

            return (
              <tr
                key={i}
                className={`border-t transition-colors hover:bg-muted/30 ${
                  row.isTotal || row.isSectionTotal
                    ? 'font-semibold bg-muted/10'
                    : ''
                }`}
              >
                <td
                  className="py-2 px-4"
                  style={{ paddingLeft: row.indent ? `${(row.indent + 1) * 16}px` : undefined }}
                >
                  {row.label}
                </td>
                <td
                  className={`py-2 px-4 text-right tabular-nums ${
                    row.isTotal ? 'font-bold' : ''
                  }`}
                >
                  {formatCurrency(row.real)}
                </td>
                <td className="py-2 px-4 text-right tabular-nums text-muted-foreground">
                  {formatCurrency(row.budget)}
                </td>
                <td className={`py-2 px-4 text-right tabular-nums ${varColor}`}>
                  {varAbs > 0 ? '+' : ''}
                  {formatCurrency(varAbs)}
                </td>
                <td className={`py-2 px-4 text-right tabular-nums ${varColor}`}>
                  {fmtPct(varPct)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------------
// Build USALI rows from KPI data + budgets
// -------------------------------------------------------

export interface UsaliData {
  // Revenue by center
  revenueByCenter: { centerName: string; total: number }[];
  totalRevenue: number;

  // Expenses by group
  departmentalExpenses: number;
  undistributedExpenses: number;
  payrollExpenses: number;
  fixedExpenses: number;
  totalExpenses: number;

  // Derived
  gop: number;
  gopMarginPct: number;
  ebitda: number;
  netProfit: number;
}

export interface UsaliBudgets {
  revenue_total?: number;
  departmental_expenses?: number;
  undistributed_expenses?: number;
  payroll?: number;
  fixed_expenses?: number;
  gop?: number;
  ebitda?: number;
  net_profit?: number;
}

export function buildUsaliRows(data: UsaliData, budgets: UsaliBudgets): PylRow[] {
  const rows: PylRow[] = [];

  // === INGRESOS ===
  rows.push({ label: 'INGRESOS', isHeader: true, real: 0, budget: 0 });

  for (const rc of data.revenueByCenter) {
    rows.push({
      label: rc.centerName,
      real: rc.total,
      budget: 0, // individual center budgets not tracked
      indent: 1,
    });
  }

  rows.push({
    label: 'Total Ingresos',
    real: data.totalRevenue,
    budget: budgets.revenue_total ?? 0,
    isSectionTotal: true,
    highlight: 'positive',
  });

  // === GASTOS DEPARTAMENTALES ===
  rows.push({ label: 'GASTOS DEPARTAMENTALES', isHeader: true, real: 0, budget: 0 });
  rows.push({
    label: 'Gastos Departamentales',
    real: data.departmentalExpenses,
    budget: budgets.departmental_expenses ?? 0,
    indent: 1,
    highlight: 'negative',
  });
  rows.push({
    label: 'Nómina y Salarios',
    real: data.payrollExpenses,
    budget: budgets.payroll ?? 0,
    indent: 1,
    highlight: 'negative',
  });

  // === UNDISTRIBUTED ===
  rows.push({ label: 'GASTOS NO DISTRIBUIDOS', isHeader: true, real: 0, budget: 0 });
  rows.push({
    label: 'Gastos No Distribuidos',
    real: data.undistributedExpenses,
    budget: budgets.undistributed_expenses ?? 0,
    indent: 1,
    highlight: 'negative',
  });

  // === GOP ===
  rows.push({
    label: 'Resultado Bruto de Explotación (GOP)',
    real: data.gop,
    budget: budgets.gop ?? 0,
    isTotal: true,
    highlight: data.gop >= 0 ? 'positive' : 'negative',
  });

  rows.push({
    label: `GOP % sobre ingresos`,
    real: data.gopMarginPct,
    budget: budgets.gop && budgets.revenue_total && budgets.revenue_total > 0
      ? (budgets.gop / budgets.revenue_total) * 100
      : 0,
    indent: 1,
  });

  // === FIXED EXPENSES ===
  rows.push({ label: 'GASTOS FIJOS', isHeader: true, real: 0, budget: 0 });
  rows.push({
    label: 'Gastos Fijos (sin intereses, impuestos, depr.)',
    real: data.fixedExpenses,
    budget: budgets.fixed_expenses ?? 0,
    indent: 1,
    highlight: 'negative',
  });

  // === EBITDA ===
  rows.push({
    label: 'EBITDA',
    real: data.ebitda,
    budget: budgets.ebitda ?? 0,
    isTotal: true,
    highlight: data.ebitda >= 0 ? 'positive' : 'negative',
  });

  // === NET PROFIT ===
  rows.push({
    label: 'Resultado Neto',
    real: data.netProfit,
    budget: budgets.net_profit ?? 0,
    isTotal: true,
    highlight: data.netProfit >= 0 ? 'positive' : 'negative',
  });

  return rows;
}
