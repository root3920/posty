'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TaskViewRow } from '@/hooks/use-hotel';

const PHASE_LABELS: Record<number, string> = {
  1: 'Reserva',
  2: 'Confirmación',
  3: 'Pre-llegada',
  4: 'Llegada',
  5: 'Estadía',
  6: 'Salida',
  7: 'Post-estadía',
};

interface TeamProgressPanelProps {
  tasks: TaskViewRow[];
}

export function TeamProgressPanel({ tasks }: TeamProgressPanelProps) {
  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status_type === 'done').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const nextTask = tasks.find((t) => t.status_type !== 'done' && t.status_type !== 'cancelled');
    return { total, done, pct, nextTask };
  }, [tasks]);

  // Group tasks by phase
  const tasksByPhase = useMemo(() => {
    const groups = new Map<number, TaskViewRow[]>();
    for (const task of tasks) {
      const phase = task.phase ?? 0;
      const list = groups.get(phase) ?? [];
      list.push(task);
      groups.set(phase, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground">
        No hay tareas del flujo para esta estancia.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">¿En qué va mi equipo?</h3>
        <span className="text-xs text-muted-foreground">
          {stats.done}/{stats.total} tareas
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${stats.pct}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">{stats.pct}% completado</p>
      </div>

      {/* Next step */}
      {stats.nextTask && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
          <ArrowRight className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">Siguiente paso</p>
            <p className="text-sm truncate">{stats.nextTask.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {stats.nextTask.assigned_role_name && (
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${stats.nextTask.assigned_role_color}15`,
                    color: stats.nextTask.assigned_role_color,
                  }}
                >
                  {stats.nextTask.assigned_role_name}
                </span>
              )}
              {stats.nextTask.due_date && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(stats.nextTask.due_date), "d MMM · HH:mm", { locale: es })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tasks grouped by phase */}
      <div className="space-y-3">
        {tasksByPhase.map(([phase, phaseTasks]) => {
          const phaseLabel = PHASE_LABELS[phase] ?? `Fase ${phase}`;
          const phaseDone = phaseTasks.filter((t) => t.status_type === 'done').length;
          const phaseTotal = phaseTasks.length;

          return (
            <div key={phase} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {phase}. {phaseLabel}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {phaseDone}/{phaseTotal}
                </span>
              </div>
              {phaseTasks.map((task) => {
                const isDone = task.status_type === 'done';
                const isOverdue =
                  !isDone && task.due_date && new Date(task.due_date) < new Date();

                return (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                      isDone && 'opacity-60',
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <div
                        className={cn(
                          'h-4 w-4 rounded-full border-2 shrink-0',
                          isOverdue ? 'border-destructive' : 'border-muted-foreground/40',
                        )}
                      />
                    )}
                    <span className={cn('flex-1 truncate', isDone && 'line-through')}>
                      {task.title}
                    </span>
                    {task.assigned_role_name && (
                      <Badge
                        variant="outline"
                        className="text-[9px] shrink-0"
                        style={{ borderColor: task.assigned_role_color }}
                      >
                        {task.assigned_role_name}
                      </Badge>
                    )}
                    {isOverdue && (
                      <span className="text-[10px] text-destructive shrink-0 font-medium">
                        Vencida
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
