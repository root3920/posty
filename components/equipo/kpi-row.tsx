'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Users, CheckCircle2, Clock, AlertTriangle, UserX, CalendarCheck } from 'lucide-react';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface TeamKPIs {
  onShiftNow: number;
  available: number;
  absentToday: number;
  pendingToday: number;
  completedToday: number;
  overdueToday: number;
}

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: 'green' | 'red' | 'amber' | 'blue' | 'gray';
}

// -------------------------------------------------------
// Single KPI card
// -------------------------------------------------------

const HIGHLIGHT_STYLES: Record<
  NonNullable<KpiCardProps['highlight']>,
  { card: string; icon: string; value: string }
> = {
  green: {
    card: 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30',
    icon: 'text-green-600 dark:text-green-400',
    value: 'text-green-700 dark:text-green-300',
  },
  red: {
    card: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
    icon: 'text-red-600 dark:text-red-400',
    value: 'text-red-700 dark:text-red-300',
  },
  amber: {
    card: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
    icon: 'text-amber-600 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-300',
  },
  blue: {
    card: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
    icon: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
  },
  gray: {
    card: 'border-border bg-card',
    icon: 'text-muted-foreground',
    value: 'text-foreground',
  },
};

function KpiCard({ label, value, icon, highlight = 'gray' }: KpiCardProps) {
  const styles = HIGHLIGHT_STYLES[highlight];
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${styles.card}`}>
      <div className={`shrink-0 ${styles.icon}`}>{icon}</div>
      <div>
        <p
          className={`text-2xl font-bold tabular-nums leading-none ${styles.value}`}
        >
          {new Intl.NumberFormat('es').format(value)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// KPI row
// -------------------------------------------------------

interface KpiRowProps {
  kpis: TeamKPIs;
}

export function KpiRow({ kpis }: KpiRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        label="En turno ahora"
        value={kpis.onShiftNow}
        icon={<Users className="h-5 w-5" />}
        highlight="green"
      />
      <KpiCard
        label="Disponibles"
        value={kpis.available}
        icon={<CalendarCheck className="h-5 w-5" />}
        highlight="blue"
      />
      <KpiCard
        label="Ausentes hoy"
        value={kpis.absentToday}
        icon={<UserX className="h-5 w-5" />}
        highlight={kpis.absentToday > 0 ? 'amber' : 'gray'}
      />
      <KpiCard
        label="Tareas pendientes"
        value={kpis.pendingToday}
        icon={<Clock className="h-5 w-5" />}
        highlight="gray"
      />
      <KpiCard
        label="Completadas hoy"
        value={kpis.completedToday}
        icon={<CheckCircle2 className="h-5 w-5" />}
        highlight="green"
      />
      <KpiCard
        label="Tareas vencidas"
        value={kpis.overdueToday}
        icon={<AlertTriangle className="h-5 w-5" />}
        highlight={kpis.overdueToday > 0 ? 'red' : 'gray'}
      />
    </div>
  );
}

// -------------------------------------------------------
// Skeleton loader
// -------------------------------------------------------

export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <Skeleton className="mb-2 h-7 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
