'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  format,
  isSameDay,
} from 'date-fns';
import { es } from 'date-fns/locale';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface WeeklyEmployeeRow {
  id: string;
  full_name: string;
  /** Map of ISO date string ("YYYY-MM-DD") → cell data */
  days: Record<
    string,
    {
      shiftLabel: string; // "07:00 – 15:00" | "Descanso" | "Ausente"
      pending: number;
      completed: number;
    }
  >;
}

interface WeeklyViewProps {
  employees: WeeklyEmployeeRow[];
  isLoading?: boolean;
}

// -------------------------------------------------------
// Chart: stacked bar (completed vs pending) by day
// -------------------------------------------------------

function WeekChart({
  employees,
  weekDays,
}: {
  employees: WeeklyEmployeeRow[];
  weekDays: Date[];
}) {
  const data = weekDays.map((day) => {
    const key = format(day, 'yyyy-MM-dd');
    let pending = 0;
    let completed = 0;
    for (const emp of employees) {
      const cell = emp.days[key];
      if (cell) {
        pending += cell.pending;
        completed += cell.completed;
      }
    }
    return {
      name: format(day, 'EEE d', { locale: es }),
      Completadas: completed,
      Pendientes: pending,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            fontSize: '12px',
            border: '1px solid hsl(var(--border))',
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '12px' }}
        />
        <Bar dataKey="Completadas" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Pendientes" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// -------------------------------------------------------
// Grid cell
// -------------------------------------------------------

function DayCell({
  shiftLabel,
  pending,
  completed,
  isToday,
}: {
  shiftLabel: string;
  pending: number;
  completed: number;
  isToday: boolean;
}) {
  const isOff = shiftLabel === 'Descanso' || shiftLabel === 'Ausente';
  return (
    <td
      className={`border-b border-r px-2 py-2 text-center text-xs align-top ${
        isToday ? 'bg-blue-50 dark:bg-blue-950/20' : ''
      }`}
    >
      <p
        className={`font-medium ${
          isOff ? 'text-muted-foreground' : 'text-foreground'
        }`}
      >
        {shiftLabel}
      </p>
      {!isOff && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {completed}✓ {pending}⏳
        </p>
      )}
    </td>
  );
}

// -------------------------------------------------------
// Main component
// -------------------------------------------------------

export function WeeklyView({ employees, isLoading = false }: WeeklyViewProps) {
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());

  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const today = new Date();
  const weekLabel = `${format(weekStart, "d 'de' MMM", { locale: es })} – ${format(
    weekEnd,
    "d 'de' MMM yyyy",
    { locale: es },
  )}`;

  function prevWeek() {
    setReferenceDate((d) => subWeeks(d, 1));
  }
  function nextWeek() {
    setReferenceDate((d) => addWeeks(d, 1));
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={prevWeek} aria-label="Semana anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize">{weekLabel}</span>
        <Button variant="outline" size="icon" onClick={nextWeek} aria-label="Semana siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 z-10 border-r bg-muted/50 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Empleado
              </th>
              {weekDays.map((day) => (
                <th
                  key={day.toISOString()}
                  className={`border-r px-2 py-2 text-center text-xs font-medium ${
                    isSameDay(day, today)
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'text-muted-foreground'
                  }`}
                >
                  <span className="block capitalize">
                    {format(day, 'EEE', { locale: es })}
                  </span>
                  <span className="block text-[11px]">{format(day, 'd')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td
                  colSpan={weekDays.length + 1}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No hay empleados para mostrar
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted/30">
                  <td className="sticky left-0 z-10 border-b border-r bg-card px-3 py-2 text-xs font-medium whitespace-nowrap">
                    {emp.full_name}
                  </td>
                  {weekDays.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const cell = emp.days[key] ?? {
                      shiftLabel: '—',
                      pending: 0,
                      completed: 0,
                    };
                    return (
                      <DayCell
                        key={key}
                        shiftLabel={cell.shiftLabel}
                        pending={cell.pending}
                        completed={cell.completed}
                        isToday={isSameDay(day, today)}
                      />
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bar chart */}
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          Tareas por día — semana actual
        </p>
        <WeekChart employees={employees} weekDays={weekDays} />
      </div>
    </div>
  );
}
