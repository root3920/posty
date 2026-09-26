'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatPercent } from '@/lib/format';
import type { RevenueByCenterItem } from '@/hooks/use-finance';

// -------------------------------------------------------
// Color palette
// -------------------------------------------------------

const COLORS = [
  '#6366f1', // indigo
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#ec4899', // pink
  '#14b8a6', // teal
  '#8b5cf6', // violet
];

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface DailyRevenueExpense {
  date: string;
  ingresos: number;
  gastos: number;
}

export interface DailyOccupancyADR {
  date: string;
  ocupacion: number;
  adr: number;
}

// -------------------------------------------------------
// Revenue vs Expenses Line Chart
// -------------------------------------------------------

interface RevenueExpenseChartProps {
  data: DailyRevenueExpense[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: { color: string; name: string; value: number }, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function RevenueExpenseChart({ data }: RevenueExpenseChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis
          tickFormatter={(v) =>
            new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
          }
          tick={{ fontSize: 11 }}
        />
        <Tooltip content={<CurrencyTooltip />} />
        <Legend wrapperStyle={{ fontSize: '11px' }} />
        <Line
          type="monotone"
          dataKey="ingresos"
          name="Ingresos"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="gastos"
          name="Gastos"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// -------------------------------------------------------
// Occupancy & ADR Bar Chart
// -------------------------------------------------------

interface OccupancyADRChartProps {
  data: DailyOccupancyADR[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OccupancyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry: { color: string; name: string; value: number; dataKey: string }, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}:{' '}
          {entry.dataKey === 'ocupacion'
            ? formatPercent(entry.value, 1)
            : formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function OccupancyADRChart({ data }: OccupancyADRChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={(v) =>
            new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
          }
          tick={{ fontSize: 11 }}
        />
        <Tooltip content={<OccupancyTooltip />} />
        <Legend wrapperStyle={{ fontSize: '11px' }} />
        <Bar yAxisId="left" dataKey="ocupacion" name="Ocupación %" fill="#6366f1" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="right" dataKey="adr" name="ADR" fill="#22c55e" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// -------------------------------------------------------
// Revenue by Center Donut/Pie Chart
// -------------------------------------------------------

interface RevenueByCenterChartProps {
  data: RevenueByCenterItem[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
      <p className="font-medium">{entry.name}</p>
      <p style={{ color: entry.payload.fill }}>{formatCurrency(entry.value)}</p>
    </div>
  );
}

export function RevenueByCenterChart({ data }: RevenueByCenterChartProps) {
  const chartData = data.map((item) => ({
    name: item.centerName,
    value: item.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltipContent />} />
        <Legend wrapperStyle={{ fontSize: '11px' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// -------------------------------------------------------
// Revenue by Payment Method Pie Chart
// -------------------------------------------------------

interface RevenueByPaymentChartProps {
  data: Record<string, number>;
}

export function RevenueByPaymentChart({ data }: RevenueByPaymentChartProps) {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltipContent />} />
        <Legend wrapperStyle={{ fontSize: '11px' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// -------------------------------------------------------
// Top Expense Categories Horizontal Bar Chart
// -------------------------------------------------------

interface TopExpenseCategoriesChartProps {
  data: { name: string; amount: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ExpenseTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
      <p className="font-medium">{label}</p>
      <p style={{ color: payload[0].color }}>{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export function TopExpenseCategoriesChart({ data }: TopExpenseCategoriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) =>
            new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
          }
          tick={{ fontSize: 11 }}
        />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
        <Tooltip content={<ExpenseTooltip />} />
        <Bar dataKey="amount" name="Gastos" fill="#6366f1" radius={[0, 3, 3, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
