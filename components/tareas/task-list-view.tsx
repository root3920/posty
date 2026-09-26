'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { TaskWithRelations } from '@/hooks/use-tasks';
import type { Tables } from '@/types/database';
import {
  AssigneeAvatars,
  PriorityBadge,
  LabelBadges,
  formatDueDate,
  dueDateColor,
} from './task-shared';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

type SortKey = 'due_date' | 'priority' | 'created_at';

interface TaskListViewProps {
  tasks: TaskWithRelations[];
  statuses: Tables<'task_statuses'>[];
  isLoading: boolean;
  onTaskClick: (task: TaskWithRelations) => void;
}

// -------------------------------------------------------
// Priority sort order
// -------------------------------------------------------

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// -------------------------------------------------------
// Task row
// -------------------------------------------------------

function TaskRow({
  task,
  onClick,
}: {
  task: TaskWithRelations;
  onClick: () => void;
}) {
  const dueDateStr = formatDueDate(task.due_date);
  const dateColor = dueDateColor(task.due_date, task.completed_at);
  const isDone = task.status?.type === 'done';

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
    >
      {/* Priority color strip */}
      <span
        className="h-4 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: getPriorityColor(task.priority) }}
      />

      {/* Title + labels */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium leading-tight ${
            isDone ? 'text-muted-foreground line-through' : 'text-foreground'
          }`}
        >
          {task.title}
        </p>
        {task.labels.length > 0 && (
          <div className="mt-1">
            <LabelBadges labels={task.labels} />
          </div>
        )}
      </div>

      {/* Subtask count */}
      {task.subtask_count > 0 && (
        <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          {task.subtask_count}
        </div>
      )}

      {/* Priority badge */}
      <div className="shrink-0">
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Assignees */}
      <div className="shrink-0">
        <AssigneeAvatars assignees={task.assignees} size="xs" />
      </div>

      {/* Due date */}
      {dueDateStr && (
        <span className={`shrink-0 text-xs ${dateColor}`}>{dueDateStr}</span>
      )}
    </button>
  );
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    urgent: '#ef4444',
    high: '#f59e0b',
    normal: '#3b82f6',
    low: '#6b7280',
  };
  return colors[priority] ?? '#6b7280';
}

// -------------------------------------------------------
// Status group
// -------------------------------------------------------

function StatusGroup({
  status,
  tasks,
  onTaskClick,
}: {
  status: Tables<'task_statuses'>;
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="space-y-1">
      {/* Group header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold hover:bg-muted/50"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <span>{status.name}</span>
        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {tasks.length}
        </span>
      </button>

      {/* Tasks */}
      {!collapsed && (
        <div className="ml-4 space-y-0.5">
          {tasks.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Sin tareas en este estado
            </p>
          ) : (
            tasks.map((task) => (
              <TaskRow key={task.id} task={task} onClick={() => onTaskClick(task)} />
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

function TaskListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-6 w-40" />
          {[1, 2, 3].map((j) => (
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

export function TaskListView({ tasks, statuses, isLoading, onTaskClick }: TaskListViewProps) {
  const [sortBy, setSortBy] = useState<SortKey>('created_at');

  // Group tasks by status
  const grouped = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      if (sortBy === 'due_date') {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      if (sortBy === 'priority') {
        return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
      }
      // created_at
      return b.created_at.localeCompare(a.created_at);
    });

    const map = new Map<string, TaskWithRelations[]>();
    for (const status of statuses) {
      map.set(status.id, []);
    }
    for (const task of sorted) {
      if (!task.parent_task_id) {
        // Only top-level tasks in list view
        const arr = map.get(task.status_id);
        if (arr) arr.push(task);
        else map.set(task.status_id, [task]);
      }
    }
    return map;
  }, [tasks, statuses, sortBy]);

  if (isLoading) return <TaskListSkeleton />;

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">Ordenar por:</span>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Fecha creación</SelectItem>
            <SelectItem value="due_date">Fecha vencimiento</SelectItem>
            <SelectItem value="priority">Prioridad</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status groups */}
      <div className="space-y-4">
        {statuses.map((status) => (
          <StatusGroup
            key={status.id}
            status={status}
            tasks={grouped.get(status.id) ?? []}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">No hay tareas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crea una tarea para empezar
          </p>
        </div>
      )}
    </div>
  );
}
