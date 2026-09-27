'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { GripVertical, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import type { TaskWithRelations } from '@/hooks/use-tasks';
import type { Tables } from '@/types/database';
import { updateTaskStatusAction } from '@/app/actions/tasks';
import { AssigneeAvatars, UnassignedRoleChip, formatDueDate, dueDateColor, PRIORITY_CONFIG } from './task-shared';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface TaskKanbanViewProps {
  tasks: TaskWithRelations[];
  statuses: Tables<'task_statuses'>[];
  isLoading: boolean;
  onTaskClick: (task: TaskWithRelations) => void;
}

// -------------------------------------------------------
// Kanban Card
// -------------------------------------------------------

interface KanbanCardProps {
  task: TaskWithRelations;
  onClick: () => void;
  isDragging?: boolean;
}

function KanbanCard({ task, onClick, isDragging = false }: KanbanCardProps) {
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const dueDateStr = formatDueDate(task.due_date);
  const dateColor = dueDateColor(task.due_date, task.completed_at);

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      {/* Priority color strip */}
      <div
        className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
        style={{ backgroundColor: priorityCfg.color }}
      />

      <div className="pl-3">
        {/* Title */}
        <p className="text-sm font-medium leading-snug text-foreground">{task.title}</p>

        {/* Labels */}
        {task.labels.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {task.labels.slice(0, 2).map((l) => (
              <Badge
                key={l.id}
                variant="outline"
                className="text-[10px]"
                style={{
                  backgroundColor: `${l.label.color}15`,
                  borderColor: `${l.label.color}40`,
                  color: l.label.color,
                }}
              >
                {l.label.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer row */}
        <div className="mt-2 flex items-center justify-between gap-2">
          {task.assignees.length > 0 ? (
            <AssigneeAvatars assignees={task.assignees} size="xs" max={3} />
          ) : (task as unknown as Record<string, unknown>)['assigned_role_id'] ? (
            <UnassignedRoleChip
              roleName={((task as unknown as Record<string, unknown>)['assigned_role_name'] as string | undefined) ?? 'Rol'}
              roleColor={((task as unknown as Record<string, unknown>)['assigned_role_color'] as string | null | undefined) ?? null}
              size="xs"
            />
          ) : <span />}

          {dueDateStr && (
            <div className={`flex items-center gap-1 text-xs ${dateColor}`}>
              <CalendarDays className="h-3 w-3" />
              {dueDateStr}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Sortable Kanban Card wrapper
// -------------------------------------------------------

function SortableKanbanCard({
  task,
  onClick,
}: {
  task: TaskWithRelations;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute right-2 top-2 z-10 cursor-grab touch-none opacity-0 group-hover:opacity-100 active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <KanbanCard task={task} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

// -------------------------------------------------------
// Kanban Column
// -------------------------------------------------------

function KanbanColumn({
  status,
  tasks,
  onTaskClick,
}: {
  status: Tables<'task_statuses'>;
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
}) {
  const { setNodeRef, isOver } = useSortable({
    id: `col-${status.id}`,
    data: { type: 'column', statusId: status.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-72 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors ${
        isOver ? 'border-primary/50 bg-primary/5' : ''
      }`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <span className="text-sm font-semibold">{status.name}</span>
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableKanbanCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex items-center justify-center rounded-lg border border-dashed py-8 text-xs text-muted-foreground">
            Sin tareas
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Skeleton
// -------------------------------------------------------

function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="w-72 shrink-0 space-y-2">
          <Skeleton className="h-8 w-full" />
          {[1, 2, 3].map((j) => (
            <Skeleton key={j} className="h-24 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------
// Main component
// -------------------------------------------------------

export function TaskKanbanView({ tasks, statuses, isLoading, onTaskClick }: TaskKanbanViewProps) {
  const queryClient = useQueryClient();
  const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);

  // Local optimistic state
  const [optimisticTasks, setOptimisticTasks] = useState<TaskWithRelations[] | null>(null);
  const displayTasks = optimisticTasks ?? tasks;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const topLevelTasks = displayTasks.filter((t) => !t.parent_task_id);

  const getTasksByStatus = useCallback(
    (statusId: string) => topLevelTasks.filter((t) => t.status_id === statusId),
    [topLevelTasks],
  );

  function onDragStart(event: DragStartEvent) {
    const { active } = event;
    const task = active.data.current?.task as TaskWithRelations | undefined;
    if (task) setActiveTask(task);
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeTask = active.data.current?.task as TaskWithRelations | undefined;
    if (!activeTask) return;

    // Determine target status
    let targetStatusId: string | null = null;

    if (over.data.current?.type === 'column') {
      targetStatusId = over.data.current.statusId as string;
    } else if (over.data.current?.type === 'task') {
      const overTask = over.data.current.task as TaskWithRelations;
      targetStatusId = overTask.status_id;
    }

    if (!targetStatusId || targetStatusId === activeTask.status_id) return;

    // Optimistic update
    const base = optimisticTasks ?? tasks;
    setOptimisticTasks(
      base.map((t) =>
        t.id === activeTask.id ? { ...t, status_id: targetStatusId! } : t,
      ),
    );
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      setOptimisticTasks(null);
      return;
    }

    const draggedTask = active.data.current?.task as TaskWithRelations | undefined;
    if (!draggedTask) {
      setOptimisticTasks(null);
      return;
    }

    // Find final status
    let finalStatusId: string | null = null;
    if (over.data.current?.type === 'column') {
      finalStatusId = over.data.current.statusId as string;
    } else if (over.data.current?.type === 'task') {
      const overTask = over.data.current.task as TaskWithRelations;
      finalStatusId = overTask.status_id;
    }

    if (!finalStatusId || finalStatusId === draggedTask.status_id) {
      setOptimisticTasks(null);
      return;
    }

    // Persist
    const result = await updateTaskStatusAction(draggedTask.id, finalStatusId);
    if (result.error) {
      // Rollback
      setOptimisticTasks(null);
      console.error('Status update failed:', result.error);
    } else {
      // Invalidate query so fresh data comes in
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setOptimisticTasks(null);
    }
  }

  if (isLoading) return <KanbanSkeleton />;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        <SortableContext
          items={statuses.map((s) => `col-${s.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {statuses.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              tasks={getTasksByStatus(status.id)}
              onTaskClick={onTaskClick}
            />
          ))}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="rotate-2 opacity-90">
            <KanbanCard task={activeTask} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
