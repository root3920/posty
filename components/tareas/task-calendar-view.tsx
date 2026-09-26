'use client';

import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  eachDayOfInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import type { TaskWithRelations } from '@/hooks/use-tasks';
import { PRIORITY_CONFIG } from './task-shared';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface TaskCalendarViewProps {
  tasks: TaskWithRelations[];
  isLoading: boolean;
  onDayClick: (dateStr: string) => void;
  onTaskClick: (task: TaskWithRelations) => void;
}

// -------------------------------------------------------
// Day cell
// -------------------------------------------------------

function DayCell({
  date,
  tasks,
  isCurrentMonth,
  onDayClick,
  onTaskClick,
}: {
  date: Date;
  tasks: TaskWithRelations[];
  isCurrentMonth: boolean;
  onDayClick: () => void;
  onTaskClick: (task: TaskWithRelations) => void;
}) {
  const todayFlag = isToday(date);
  const MAX_SHOWN = 3;
  const shown = tasks.slice(0, MAX_SHOWN);
  const extra = tasks.length - shown.length;

  return (
    <div
      className={`min-h-[100px] rounded-lg border p-1.5 transition-colors ${
        isCurrentMonth ? 'bg-background' : 'bg-muted/20'
      } ${tasks.length > 0 ? 'cursor-pointer hover:border-primary/50' : ''}`}
      onClick={tasks.length > 0 ? onDayClick : undefined}
    >
      {/* Day number */}
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
            todayFlag
              ? 'bg-primary text-primary-foreground'
              : isCurrentMonth
                ? 'text-foreground'
                : 'text-muted-foreground'
          }`}
        >
          {format(date, 'd')}
        </span>
        {tasks.length > 0 && (
          <span className="rounded-full bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
            {tasks.length}
          </span>
        )}
      </div>

      {/* Task items */}
      <div className="space-y-0.5">
        {shown.map((task) => {
          const priorityCfg = PRIORITY_CONFIG[task.priority];
          return (
            <button
              key={task.id}
              onClick={(e) => {
                e.stopPropagation();
                onTaskClick(task);
              }}
              className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: priorityCfg.color }}
              />
              <span className="truncate text-[11px] leading-tight">{task.title}</span>
            </button>
          );
        })}
        {extra > 0 && (
          <p className="px-1 text-[10px] text-muted-foreground">+{extra} más</p>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Skeleton
// -------------------------------------------------------

function CalendarSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Main component
// -------------------------------------------------------

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function TaskCalendarView({
  tasks,
  isLoading,
  onDayClick,
  onTaskClick,
}: TaskCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  // Build calendar grid: Mon–Sun
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  // Build a map of dateStr → tasks
  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskWithRelations[]> = {};
    for (const task of tasks) {
      if (!task.due_date) continue;
      if (!map[task.due_date]) map[task.due_date] = [];
      map[task.due_date].push(task);
    }
    return map;
  }, [tasks]);

  if (isLoading) return <CalendarSkeleton />;

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => setCurrentMonth(new Date())}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[dateStr] ?? [];
          return (
            <DayCell
              key={dateStr}
              date={date}
              tasks={dayTasks}
              isCurrentMonth={isSameMonth(date, currentMonth)}
              onDayClick={() => onDayClick(dateStr)}
              onTaskClick={onTaskClick}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <span className="text-xs text-muted-foreground">Prioridad:</span>
        {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: cfg.color }}
            />
            <span className="text-xs text-muted-foreground">{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
