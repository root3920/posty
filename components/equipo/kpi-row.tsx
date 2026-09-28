'use client';

import { Users, CheckCircle2, Clock, AlertTriangle, UserX, CalendarCheck } from 'lucide-react';
import { KpiCard, KpiCardSkeleton } from '@/components/shared/kpi-card';

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
      />
      <KpiCard
        label="Disponibles"
        value={kpis.available}
        icon={<CalendarCheck className="h-5 w-5" />}
      />
      <KpiCard
        label="Ausentes hoy"
        value={kpis.absentToday}
        icon={<UserX className="h-5 w-5" />}
      />
      <KpiCard
        label="Tareas pendientes"
        value={kpis.pendingToday}
        icon={<Clock className="h-5 w-5" />}
      />
      <KpiCard
        label="Completadas hoy"
        value={kpis.completedToday}
        icon={<CheckCircle2 className="h-5 w-5" />}
      />
      <KpiCard
        label="Tareas vencidas"
        value={kpis.overdueToday}
        icon={<AlertTriangle className="h-5 w-5" />}
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
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}
