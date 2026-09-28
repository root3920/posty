'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, X } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/hooks/use-organization';
import {
  calculateAvailability,
  type WorkScheduleBlock,
  type TimeOffEntry,
} from '@/lib/availability';
import type { Tables, Enums } from '@/types/database';

import { KpiRow, KpiRowSkeleton, type TeamKPIs } from '@/components/equipo/kpi-row';
import { KpiGrid } from '@/components/shared/kpi-grid';
import {
  EmployeeCard,
  EmployeeCardSkeleton,
  type EmployeeCardData,
} from '@/components/equipo/employee-card';
import {
  WeeklyView,
  type WeeklyEmployeeRow,
} from '@/components/equipo/weekly-view';

// -------------------------------------------------------
// Types from DB
// -------------------------------------------------------

type Profile = Tables<'profiles'>;
type WorkSchedule = Tables<'work_schedules'>;
type TimeOff = Tables<'time_off'>;

interface ProfileWithRelations extends Profile {
  role: {
    id: string;
    name: string;
    color: string;
  } | null;
  work_schedules: WorkSchedule[];
  time_off: TimeOff[];
}

interface TaskStat {
  profile_id: string;
  stat_date: string;
  pending_count: number;
  completed_count: number;
  overdue_count: number;
}

// -------------------------------------------------------
// Data fetching
// -------------------------------------------------------

async function fetchTeamData(): Promise<ProfileWithRelations[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
      *,
      role:roles(id, name, color),
      work_schedules(*),
      time_off(*)
    `,
    )
    .eq('is_active', true)
    .order('full_name');

  if (error) throw error;
  return (data ?? []) as unknown as ProfileWithRelations[];
}

async function fetchTaskStats(from: string, to: string): Promise<TaskStat[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('team_task_stats', {
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return (data ?? []) as TaskStat[];
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function formatTime(t: string): string {
  return t.slice(0, 5); // "HH:MM:SS" → "HH:MM"
}

function buildTodayScheduleLabel(
  schedules: WorkSchedule[],
  weekday: number,
): string {
  const dayOff = schedules.find((s) => s.weekday === weekday && s.is_day_off);
  if (dayOff) return 'Descanso';

  const block = schedules.find((s) => s.weekday === weekday && !s.is_day_off);
  if (!block) return 'Descanso';

  return `${formatTime(block.start_time)} – ${formatTime(block.end_time)}`;
}

function buildWeekScheduleLabel(
  schedules: WorkSchedule[],
  weekday: number,
  isAbsent: boolean,
): string {
  if (isAbsent) return 'Ausente';

  const dayOff = schedules.find((s) => s.weekday === weekday && s.is_day_off);
  if (dayOff) return 'Descanso';

  const block = schedules.find((s) => s.weekday === weekday && !s.is_day_off);
  if (!block) return 'Descanso';

  return `${formatTime(block.start_time)} – ${formatTime(block.end_time)}`;
}

// Weekday in "0=Monday…6=Sunday" from a Date
function dateToWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

// -------------------------------------------------------
// Main page
// -------------------------------------------------------

export default function EquipoPage() {
  const { timezone } = useOrganization();

  const now = useMemo(() => new Date(), []);
  const todayStr = format(now, 'yyyy-MM-dd');

  // Week range for stats
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekFrom = format(weekStart, 'yyyy-MM-dd');
  const weekTo = format(weekEnd, 'yyyy-MM-dd');

  // Queries
  const teamQuery = useQuery({
    queryKey: ['team'],
    queryFn: fetchTeamData,
    staleTime: 2 * 60 * 1000,
  });

  const statsQuery = useQuery({
    queryKey: ['team_task_stats', weekFrom, weekTo],
    queryFn: () => fetchTaskStats(weekFrom, weekTo),
    staleTime: 2 * 60 * 1000,
  });

  // Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // -------------------------------------------------------
  // Derived data
  // -------------------------------------------------------

  const employees = teamQuery.data ?? [];
  const stats = statsQuery.data ?? [];

  // Build a lookup: profileId → stat_date → stats
  const statsMap = useMemo(() => {
    const map: Record<string, Record<string, TaskStat>> = {};
    for (const s of stats) {
      if (!map[s.profile_id]) map[s.profile_id] = {};
      map[s.profile_id][s.stat_date] = s;
    }
    return map;
  }, [stats]);

  // Compute availability for each employee
  const employeeCards = useMemo((): EmployeeCardData[] => {
    return employees.map((emp) => {
      const availability = calculateAvailability({
        now,
        timezone,
        availability_override: emp.availability_override as Enums<'availability_status'> | null,
        schedules: emp.work_schedules as WorkScheduleBlock[],
        timeOff: emp.time_off as TimeOffEntry[],
      });

      const todayWeekday = dateToWeekday(now);
      const isAbsent = availability.status === 'absent';
      const todaySchedule = isAbsent
        ? 'Ausente'
        : buildTodayScheduleLabel(emp.work_schedules, todayWeekday);

      const todayStats = statsMap[emp.id]?.[todayStr] ?? {
        pending_count: 0,
        completed_count: 0,
        overdue_count: 0,
      };

      return {
        id: emp.id,
        full_name: emp.full_name,
        avatar_url: emp.avatar_url,
        job_title: emp.job_title,
        role: emp.role,
        todaySchedule,
        availability,
        pending: Number(todayStats.pending_count),
        completed: Number(todayStats.completed_count),
        overdue: Number(todayStats.overdue_count),
      };
    });
  }, [employees, now, timezone, statsMap, todayStr]);

  // Unique roles for filter
  const allRoles = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>();
    for (const emp of employees) {
      if (emp.role && !seen.has(emp.role.id)) {
        seen.set(emp.role.id, emp.role);
      }
    }
    return Array.from(seen.values());
  }, [employees]);

  // Filtered cards
  const filteredCards = useMemo(() => {
    return employeeCards.filter((card) => {
      if (search && !card.full_name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (roleFilter && card.role?.name !== roleFilter) return false;
      if (statusFilter && card.availability.status !== statusFilter) return false;
      return true;
    });
  }, [employeeCards, search, roleFilter, statusFilter]);

  // KPIs
  const kpis = useMemo((): TeamKPIs => {
    return {
      onShiftNow: employeeCards.filter((c) => c.availability.status === 'on_shift').length,
      available: employeeCards.filter(
        (c) => c.availability.status === 'available' || c.availability.status === 'on_shift',
      ).length,
      absentToday: employeeCards.filter((c) => c.availability.status === 'absent').length,
      pendingToday: employeeCards.reduce((s, c) => s + c.pending, 0),
      completedToday: employeeCards.reduce((s, c) => s + c.completed, 0),
      overdueToday: employeeCards.reduce((s, c) => s + c.overdue, 0),
    };
  }, [employeeCards]);

  // Weekly view rows
  const weeklyRows = useMemo((): WeeklyEmployeeRow[] => {
    // Build array of days in the week
    const days: string[] = [];
    const cursor = new Date(weekStart);
    while (cursor <= weekEnd) {
      days.push(format(cursor, 'yyyy-MM-dd'));
      cursor.setDate(cursor.getDate() + 1);
    }

    return employees.map((emp) => {
      const dayMap: WeeklyEmployeeRow['days'] = {};
      for (const dateStr of days) {
        const dayDate = new Date(`${dateStr}T12:00:00`);
        const weekday = dateToWeekday(dayDate);

        // Check time_off
        const isAbsent = (emp.time_off as TimeOff[]).some(
          (t) => t.start_date <= dateStr && t.end_date >= dateStr,
        );

        const shiftLabel = buildWeekScheduleLabel(emp.work_schedules, weekday, isAbsent);

        const dayStat = statsMap[emp.id]?.[dateStr] ?? {
          pending_count: 0,
          completed_count: 0,
          overdue_count: 0,
        };

        dayMap[dateStr] = {
          shiftLabel,
          pending: Number(dayStat.pending_count),
          completed: Number(dayStat.completed_count),
        };
      }
      return { id: emp.id, full_name: emp.full_name, days: dayMap };
    });
  }, [employees, statsMap, weekStart, weekEnd]);

  // -------------------------------------------------------
  // Status filter options
  // -------------------------------------------------------

  const statusOptions = [
    { value: 'on_shift', label: 'En turno', color: '#22c55e' },
    { value: 'available', label: 'Disponible', color: '#22c55e' },
    { value: 'busy', label: 'Ocupado', color: '#f59e0b' },
    { value: 'resting', label: 'Descansando', color: '#6b7280' },
    { value: 'absent', label: 'Ausente', color: '#ef4444' },
    { value: 'off_shift', label: 'Fuera de turno', color: '#94a3b8' },
  ];

  const isLoading = teamQuery.isLoading || statsQuery.isLoading;

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Equipo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* ====================================================== */}
      {/* HOY section */}
      {/* ====================================================== */}
      <section className="space-y-5">
        <h2 className="text-lg font-semibold tracking-tight">HOY</h2>

        {/* KPIs */}
        {isLoading ? <KpiRowSkeleton /> : <KpiRow kpis={kpis} />}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empleado…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-48 pl-8 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Role filters */}
          {allRoles.map((role) => (
            <button
              key={role.id}
              onClick={() => setRoleFilter(roleFilter === role.name ? null : role.name)}
              className="focus:outline-none"
            >
              <Badge
                variant={roleFilter === role.name ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                style={
                  roleFilter === role.name
                    ? { backgroundColor: role.color, borderColor: role.color, color: '#fff' }
                    : { borderColor: `${role.color}60`, color: role.color }
                }
              >
                {role.name}
              </Badge>
            </button>
          ))}

          {/* Status filters */}
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(statusFilter === opt.value ? null : opt.value)}
              className="focus:outline-none"
            >
              <Badge
                variant={statusFilter === opt.value ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                style={
                  statusFilter === opt.value
                    ? { backgroundColor: opt.color, borderColor: opt.color, color: '#fff' }
                    : { borderColor: `${opt.color}60`, color: opt.color }
                }
              >
                {opt.label}
              </Badge>
            </button>
          ))}

          {/* Clear filters */}
          {(roleFilter || statusFilter || search) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => {
                setRoleFilter(null);
                setStatusFilter(null);
                setSearch('');
              }}
            >
              <X className="mr-1 h-3 w-3" />
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* Employee grid */}
        {isLoading ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <EmployeeCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No se encontraron empleados
            </p>
            {(roleFilter || statusFilter || search) && (
              <Button
                variant="link"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => {
                  setRoleFilter(null);
                  setStatusFilter(null);
                  setSearch('');
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))' }}>
            {filteredCards.map((card) => (
              <EmployeeCard key={card.id} employee={card} />
            ))}
          </div>
        )}
      </section>

      {/* ====================================================== */}
      {/* VISTA SEMANAL section */}
      {/* ====================================================== */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">VISTA SEMANAL</h2>
        <WeeklyView employees={weeklyRows} isLoading={isLoading} />
      </section>
    </div>
  );
}
