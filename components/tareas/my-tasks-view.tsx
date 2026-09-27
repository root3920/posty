'use client';

import { useState, useMemo } from 'react';
import { isToday, isPast, isFuture } from 'date-fns';
import { ChevronDown, ChevronRight, AlertTriangle, CalendarDays, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { EntitySelect } from '@/components/shared/entity-select';

import type { TaskWithRelations } from '@/hooks/use-tasks';
import type { Tables } from '@/types/database';
import { updateTaskStatusAction } from '@/app/actions/tasks';
import { useQueryClient } from '@tanstack/react-query';
import { PriorityBadge, formatDueDate, AssigneeAvatars, PRIORITY_CONFIG } from './task-shared';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface MyTasksViewProps {
  tasks: TaskWithRelations[];
  statuses: Tables<'task_statuses'>[];
  currentUserId: string;
  isLoading: boolean;
  onTaskClick: (task: TaskWithRelations) => void;
}

// -------------------------------------------------------
// Task row with quick status change
// -------------------------------------------------------

function MyTaskRow({
  task,
  statuses,
  onStatusChange,
  onClick,
}: {
  task: TaskWithRelations;
  statuses: Tables<'task_statuses'>[];
  onStatusChange: (statusId: string | null) => void;
  onClick: () => void;
}) {
  const dueDateStr = formatDueDate(task.due_date);
  const isDone = task.status?.type === 'done';

  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
      {/* Priority strip */}
      <span
        className="h-4 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: PRIORITY_CONFIG[task.priority].color }}
      />

      {/* Title */}
      <button
        onClick={onClick}
        className={`flex-1 text-left text-sm font-medium ${
          isDone ? 'text-muted-foreground line-through' : 'text-foreground hover:text-primary'
        }`}
      >
        {task.title}
      </button>

      {/* Priority */}
      <PriorityBadge priority={task.priority} />

      {/* Assignees */}
      <AssigneeAvatars assignees={task.assignees} size="xs" max={2} />

      {/* Due date */}
      {dueDateStr && (
        <span className="text-xs text-muted-foreground">{dueDateStr}</span>
      )}

      {/* Quick status change */}
      <div className="opacity-0 transition-opacity group-hover:opacity-100 min-w-0">
        <EntitySelect
          options={statuses.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
          value={task.status_id}
          onChange={onStatusChange}
          size="sm"
          triggerClassName="h-6 w-28 text-[10px]"
        />
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Collapsible section
// -------------------------------------------------------

function CollapsibleSection({
  title,
  icon,
  count,
  tasks,
  statuses,
  onTaskClick,
  onStatusChange,
  defaultOpen = true,
  emptyMessage,
  headerClassName,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  tasks: TaskWithRelations[];
  statuses: Tables<'task_statuses'>[];
  onTaskClick: (task: TaskWithRelations) => void;
  onStatusChange: (task: TaskWithRelations, statusId: string | null) => void;
  defaultOpen?: boolean;
  emptyMessage?: string;
  headerClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold hover:bg-muted/50 ${headerClassName ?? ''}`}
      >
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {icon}
        {title}
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {count}
        </span>
      </button>

      {open && (
        <div className="ml-2 space-y-0.5">
          {tasks.length === 0 ? (
            <p className="px-5 py-2 text-xs text-muted-foreground">
              {emptyMessage ?? 'Sin tareas'}
            </p>
          ) : (
            tasks.map((task) => (
              <MyTaskRow
                key={task.id}
                task={task}
                statuses={statuses}
                onStatusChange={(statusId) => onStatusChange(task, statusId)}
                onClick={() => onTaskClick(task)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Skeleton
// -------------------------------------------------------

function MyTasksSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-8 w-48" />
          {[1, 2].map((j) => (
            <Skeleton key={j} className="ml-4 h-10 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------
// Main component
// -------------------------------------------------------

export function MyTasksView({
  tasks,
  statuses,
  currentUserId,
  isLoading,
  onTaskClick,
}: MyTasksViewProps) {
  const queryClient = useQueryClient();

  // Filter tasks assigned to current user (top-level only)
  const myTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.parent_task_id &&
          t.assignees.some((a) => a.profile_id === currentUserId) &&
          t.status?.type !== 'done' &&
          t.status?.type !== 'cancelled',
      ),
    [tasks, currentUserId],
  );

  // Bucket by due date
  const todayTasks = useMemo(
    () =>
      myTasks.filter((t) => t.due_date && isToday(new Date(`${t.due_date}T12:00:00`))),
    [myTasks],
  );

  const overdueTasks = useMemo(
    () =>
      myTasks.filter(
        (t) =>
          t.due_date &&
          isPast(new Date(`${t.due_date}T12:00:00`)) &&
          !isToday(new Date(`${t.due_date}T12:00:00`)),
      ),
    [myTasks],
  );

  const upcomingTasks = useMemo(
    () =>
      myTasks.filter(
        (t) =>
          !t.due_date ||
          isFuture(new Date(`${t.due_date}T12:00:00`)),
      ),
    [myTasks],
  );

  async function handleStatusChange(task: TaskWithRelations, statusId: string | null) {
    if (!statusId) return;
    await updateTaskStatusAction(task.id, statusId);
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }

  if (isLoading) return <MyTasksSkeleton />;

  return (
    <div className="space-y-4">
      {myTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            No tienes tareas asignadas
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Las tareas asignadas a ti aparecerán aquí
          </p>
        </div>
      )}

      {/* Overdue — shown first for urgency */}
      <CollapsibleSection
        title="Vencidas"
        icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
        count={overdueTasks.length}
        tasks={overdueTasks}
        statuses={statuses}
        onTaskClick={onTaskClick}
        onStatusChange={handleStatusChange}
        headerClassName={overdueTasks.length > 0 ? 'text-red-600' : 'text-muted-foreground'}
        emptyMessage="Sin tareas vencidas"
      />

      {/* Today */}
      <CollapsibleSection
        title="Hoy"
        icon={<CalendarDays className="h-4 w-4 text-amber-500" />}
        count={todayTasks.length}
        tasks={todayTasks}
        statuses={statuses}
        onTaskClick={onTaskClick}
        onStatusChange={handleStatusChange}
        emptyMessage="Sin tareas para hoy"
      />

      {/* Upcoming */}
      <CollapsibleSection
        title="Próximas"
        icon={<Calendar className="h-4 w-4 text-blue-500" />}
        count={upcomingTasks.length}
        tasks={upcomingTasks}
        statuses={statuses}
        onTaskClick={onTaskClick}
        onStatusChange={handleStatusChange}
        defaultOpen={false}
        emptyMessage="Sin tareas próximas"
      />
    </div>
  );
}
