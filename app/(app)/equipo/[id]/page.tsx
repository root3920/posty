'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, Phone, Mail, CalendarDays, Briefcase } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

import { createClient } from '@/lib/supabase/client';
import { useOrganization } from '@/hooks/use-organization';
import {
  calculateAvailability,
  type WorkScheduleBlock,
  type TimeOffEntry,
} from '@/lib/availability';
import type { Tables, Enums } from '@/types/database';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

type Profile = Tables<'profiles'>;
type WorkSchedule = Tables<'work_schedules'>;
type TimeOff = Tables<'time_off'>;

interface EmployeeDetail extends Profile {
  role: {
    id: string;
    name: string;
    color: string;
  } | null;
  work_schedules: WorkSchedule[];
  time_off: TimeOff[];
}

interface TaskWithStatus {
  id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  priority: Enums<'task_priority'>;
  status: {
    name: string;
    color: string;
    type: Enums<'task_status_type'>;
  } | null;
}

// -------------------------------------------------------
// Data fetching
// -------------------------------------------------------

async function fetchEmployee(id: string): Promise<EmployeeDetail | null> {
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
    .eq('id', id)
    .single();

  if (error) return null;
  return data as unknown as EmployeeDetail;
}

async function fetchEmployeeTasks(profileId: string): Promise<TaskWithStatus[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('task_assignees')
    .select(
      `
      task:tasks(
        id,
        title,
        due_date,
        completed_at,
        priority,
        archived_at,
        status:task_statuses(name, color, type)
      )
    `,
    )
    .eq('profile_id', profileId);

  if (error) return [];

  return (data ?? [])
    .map((row: { task: unknown }) => row.task as TaskWithStatus & { archived_at: string | null })
    .filter((t): t is TaskWithStatus & { archived_at: string | null } => t !== null && !t.archived_at)
    .map(({ archived_at: _a, ...t }) => t) as TaskWithStatus[];
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function formatTime(t: string): string {
  return t.slice(0, 5);
}

const PRIORITY_LABELS: Record<Enums<'task_priority'>, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baja',
};

const PRIORITY_COLORS: Record<Enums<'task_priority'>, string> = {
  urgent: '#ef4444',
  high: '#f59e0b',
  normal: '#3b82f6',
  low: '#94a3b8',
};

const TIME_OFF_LABELS: Record<Enums<'time_off_type'>, string> = {
  vacation: 'Vacaciones',
  sick_leave: 'Baja por enfermedad',
  personal: 'Permiso personal',
  other: 'Otra ausencia',
};

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { timezone } = useOrganization();

  const now = new Date();

  const employeeQuery = useQuery({
    queryKey: ['employee', id],
    queryFn: () => fetchEmployee(id),
  });

  const tasksQuery = useQuery({
    queryKey: ['employee_tasks', id],
    queryFn: () => fetchEmployeeTasks(id),
  });

  const employee = employeeQuery.data;
  const tasks = tasksQuery.data ?? [];

  // -------------------------------------------------------
  // Derived: availability
  // -------------------------------------------------------
  const availability = employee
    ? calculateAvailability({
        now,
        timezone,
        availability_override: employee.availability_override as Enums<'availability_status'> | null,
        schedules: employee.work_schedules as WorkScheduleBlock[],
        timeOff: employee.time_off as TimeOffEntry[],
      })
    : null;

  // -------------------------------------------------------
  // Derived: week schedule
  // -------------------------------------------------------
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // -------------------------------------------------------
  // Render: loading
  // -------------------------------------------------------
  if (employeeQuery.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="text-muted-foreground">Empleado no encontrado.</p>
        <Link
          href="/equipo"
          className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
        >
          Volver al equipo
        </Link>
      </div>
    );
  }

  // -------------------------------------------------------
  // Render: content
  // -------------------------------------------------------

  const pendingTasks = tasks.filter(
    (t) => t.status?.type === 'open' || t.status?.type === 'in_progress',
  );
  const completedTasks = tasks.filter((t) => t.status?.type === 'done');
  const today = format(now, 'yyyy-MM-dd');
  const overdueTasks = pendingTasks.filter(
    (t) => t.due_date !== null && t.due_date < today,
  );

  return (
    <div className="space-y-8 p-6">
      {/* Back */}
      <Link
        href="/equipo"
        className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Equipo
      </Link>

      {/* ====================================================== */}
      {/* Profile header */}
      {/* ====================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar className="h-16 w-16 shrink-0">
          {employee.avatar_url && (
            <AvatarImage src={employee.avatar_url} alt={employee.full_name} />
          )}
          <AvatarFallback className="text-lg font-semibold">
            {initials(employee.full_name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold">{employee.full_name}</h1>
            {employee.role && (
              <Badge
                variant="outline"
                className="text-xs font-medium"
                style={{
                  backgroundColor: `${employee.role.color}20`,
                  color: employee.role.color,
                  borderColor: `${employee.role.color}40`,
                }}
              >
                {employee.role.name}
              </Badge>
            )}
          </div>

          {employee.job_title && (
            <p className="text-sm text-muted-foreground">{employee.job_title}</p>
          )}

          {/* Availability */}
          {availability && (
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: availability.color }}
              />
              <span className="text-sm" style={{ color: availability.color }}>
                {availability.label}
                {availability.reason ? ` — ${availability.reason}` : ''}
              </span>
            </div>
          )}

          {/* Contact */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {employee.email && (
              <a
                href={`mailto:${employee.email}`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Mail className="h-3.5 w-3.5" />
                {employee.email}
              </a>
            )}
            {employee.phone && (
              <a
                href={`tel:${employee.phone}`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Phone className="h-3.5 w-3.5" />
                {employee.phone}
              </a>
            )}
            {employee.hire_date && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" />
                Desde {format(new Date(employee.hire_date), "d 'de' MMM yyyy", { locale: es })}
              </span>
            )}
          </div>
        </div>

        {/* Task summary */}
        <div className="flex gap-3 text-center">
          <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <p className="text-2xl font-bold text-foreground">{pendingTasks.length}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <p className="text-2xl font-bold text-green-600">{completedTasks.length}</p>
            <p className="text-xs text-muted-foreground">Completadas</p>
          </div>
          {overdueTasks.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm dark:border-red-900 dark:bg-red-950/30">
              <p className="text-2xl font-bold text-red-600">{overdueTasks.length}</p>
              <p className="text-xs text-red-500">Vencidas</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ====================================================== */}
        {/* Week schedule */}
        {/* ====================================================== */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Horario esta semana</h2>
          </div>

          <div className="rounded-xl border bg-card">
            {weekDays.map((day) => {
              const weekday = (day.getDay() + 6) % 7;
              const dateStr = format(day, 'yyyy-MM-dd');
              const isToday = dateStr === today;

              const isAbsent = (employee.time_off as TimeOff[]).some(
                (t) => t.start_date <= dateStr && t.end_date >= dateStr,
              );

              const dayOff = (employee.work_schedules as WorkSchedule[]).find(
                (s) => s.weekday === weekday && s.is_day_off,
              );
              const block = (employee.work_schedules as WorkSchedule[]).find(
                (s) => s.weekday === weekday && !s.is_day_off,
              );

              let shiftLabel: string;
              let shiftClass: string;

              if (isAbsent) {
                shiftLabel = 'Ausente';
                shiftClass = 'text-red-500';
              } else if (dayOff || !block) {
                shiftLabel = 'Descanso';
                shiftClass = 'text-muted-foreground';
              } else {
                shiftLabel = `${formatTime(block.start_time)} – ${formatTime(block.end_time)}`;
                shiftClass = 'text-foreground';
              }

              return (
                <div
                  key={dateStr}
                  className={`flex items-center justify-between border-b px-4 py-2.5 last:border-b-0 text-sm ${
                    isToday ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isToday && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}
                    <span className={`font-medium ${isToday ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                      {WEEKDAY_LABELS[weekday]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(day, 'd MMM', { locale: es })}
                    </span>
                  </div>
                  <span className={`text-xs ${shiftClass}`}>{shiftLabel}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ====================================================== */}
        {/* Time off list */}
        {/* ====================================================== */}
        <section className="space-y-3">
          <h2 className="font-semibold">Ausencias registradas</h2>

          {employee.time_off.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
              Sin ausencias registradas
            </div>
          ) : (
            <div className="rounded-xl border bg-card divide-y">
              {(employee.time_off as TimeOff[])
                .sort((a, b) => b.start_date.localeCompare(a.start_date))
                .map((t) => (
                  <div key={t.id} className="flex items-start justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{TIME_OFF_LABELS[t.type]}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(t.start_date), "d 'de' MMM yyyy", { locale: es })}
                        {t.start_date !== t.end_date &&
                          ` — ${format(new Date(t.end_date), "d 'de' MMM yyyy", { locale: es })}`}
                      </p>
                      {t.note && (
                        <p className="mt-1 text-xs text-muted-foreground">{t.note}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {t.type === 'vacation'
                        ? 'Vacaciones'
                        : t.type === 'sick_leave'
                          ? 'Enfermedad'
                          : t.type === 'personal'
                            ? 'Personal'
                            : 'Otro'}
                    </Badge>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>

      {/* ====================================================== */}
      {/* Task list */}
      {/* ====================================================== */}
      <section className="space-y-3">
        <h2 className="font-semibold">Tareas asignadas</h2>

        {tasksQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            Sin tareas asignadas
          </div>
        ) : (
          <div className="rounded-xl border bg-card divide-y">
            {tasks
              .sort((a, b) => {
                // Sort: overdue first, then by due_date, then completed last
                const aOverdue = a.due_date && a.due_date < today && a.status?.type !== 'done';
                const bOverdue = b.due_date && b.due_date < today && b.status?.type !== 'done';
                if (aOverdue && !bOverdue) return -1;
                if (!aOverdue && bOverdue) return 1;
                if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
                if (a.due_date) return -1;
                if (b.due_date) return 1;
                return 0;
              })
              .map((task) => {
                const isDone = task.status?.type === 'done';
                const isOverdue =
                  !isDone && task.due_date !== null && task.due_date < today;

                return (
                  <div
                    key={task.id}
                    className={`flex items-start justify-between px-4 py-3 text-sm ${
                      isOverdue ? 'bg-red-50/50 dark:bg-red-950/10' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-medium ${
                          isDone ? 'text-muted-foreground line-through' : 'text-foreground'
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {task.due_date && (
                          <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                            Vence:{' '}
                            {format(new Date(task.due_date), "d MMM yyyy", { locale: es })}
                            {isOverdue && ' ⚠'}
                          </span>
                        )}
                        {task.completed_at && (
                          <span>
                            Completada:{' '}
                            {format(new Date(task.completed_at), "d MMM yyyy", { locale: es })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ml-3 flex shrink-0 items-center gap-2">
                      {/* Priority badge */}
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${PRIORITY_COLORS[task.priority]}20`,
                          color: PRIORITY_COLORS[task.priority],
                        }}
                      >
                        {PRIORITY_LABELS[task.priority]}
                      </span>

                      {/* Status badge */}
                      {task.status && (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{
                            borderColor: `${task.status.color}60`,
                            color: task.status.color,
                          }}
                        >
                          {task.status.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}
