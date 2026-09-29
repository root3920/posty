'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Pencil, Zap, CalendarClock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  useRecurringTasks,
  useToggleRecurringTask,
  type RecurringTask,
} from '@/hooks/use-recurring-tasks';
import { formatFrequency, getNextOccurrences } from '@/lib/recurring-dates';
import type { RecurringTaskInput } from '@/lib/validations/recurring-tasks';

import { RecurringTaskForm } from './recurring-task-form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// -------------------------------------------------------
// Quick examples
// -------------------------------------------------------

const QUICK_EXAMPLES: { title: string; defaults: Partial<RecurringTaskInput> }[] = [
  {
    title: 'Revisar extintores',
    defaults: {
      title: 'Revisar extintores',
      frequency_type: 'monthly_day',
      frequency_config: { day_of_month: 1 },
      at_time: '09:00',
      priority: 'normal',
    },
  },
  {
    title: 'Inventario de lencería',
    defaults: {
      title: 'Inventario de lencería',
      frequency_type: 'weekly',
      frequency_config: { days_of_week: [1] },
      at_time: '08:00',
      priority: 'normal',
    },
  },
  {
    title: 'Limpieza de la piscina',
    defaults: {
      title: 'Limpieza de la piscina',
      frequency_type: 'daily',
      frequency_config: {},
      at_time: '07:00',
      priority: 'normal',
    },
  },
  {
    title: 'Revisar el aire acondicionado',
    defaults: {
      title: 'Revisar el aire acondicionado',
      frequency_type: 'every_n_days',
      frequency_config: { every_n: 90 },
      at_time: '10:00',
      priority: 'low',
    },
  },
  {
    title: 'Cierre de caja',
    defaults: {
      title: 'Cierre de caja',
      frequency_type: 'daily',
      frequency_config: {},
      at_time: '22:00',
      priority: 'high',
    },
  },
];

// -------------------------------------------------------
// Helper: get next occurrence formatted
// -------------------------------------------------------

function getNextFormatted(task: RecurringTask): string | null {
  try {
    const dates = getNextOccurrences(
      {
        frequency_type: task.frequency_type,
        frequency_config: task.frequency_config,
        at_time: task.at_time,
        start_date: task.start_date,
        end_date: task.end_date,
      },
      1,
    );
    if (dates.length === 0) return null;
    return format(dates[0], "EEE d MMM", { locale: es });
  } catch {
    return null;
  }
}

// -------------------------------------------------------
// RecurringTaskCard
// -------------------------------------------------------

function RecurringTaskCard({
  task,
  onEdit,
}: {
  task: RecurringTask;
  onEdit: () => void;
}) {
  const toggleMutation = useToggleRecurringTask();

  function handleToggle(checked: boolean) {
    toggleMutation.mutate(
      { id: task.id, isActive: checked },
      {
        onError: () => {
          toast.error('Error al cambiar el estado');
        },
      },
    );
  }

  const frequencyLabel = formatFrequency(
    task.frequency_type,
    task.frequency_config,
    task.at_time,
  );
  const nextDate = getNextFormatted(task);

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors',
        !task.is_active && 'opacity-60',
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <h3 className="font-medium text-sm leading-tight truncate">
          {task.title}
        </h3>

        {/* Role or person badge */}
        {task.role && (
          <Badge variant="secondary" className="text-[11px]">
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: task.role.color }}
            />
            {task.role.name}
          </Badge>
        )}
        {task.profile && !task.role && (
          <Badge variant="secondary" className="text-[11px]">
            {task.profile.full_name}
          </Badge>
        )}

        {/* Frequency */}
        <p className="text-xs text-muted-foreground">{frequencyLabel}</p>

        {/* Next occurrence */}
        {task.is_active && nextDate && (
          <p className="text-xs text-muted-foreground">
            Próxima: <span className="font-medium text-foreground">{nextDate}</span>
          </p>
        )}
        {task.is_active && !nextDate && task.end_date && (
          <p className="text-xs text-muted-foreground italic">Finalizada</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 pt-0.5">
        <Switch
          checked={task.is_active}
          onCheckedChange={handleToggle}
          disabled={toggleMutation.isPending}
          aria-label={task.is_active ? 'Pausar tarea' : 'Activar tarea'}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label="Editar tarea"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// RecurringTasksTab
// -------------------------------------------------------

export function RecurringTasksTab() {
  const { recurringTasks, isLoading, isError } = useRecurringTasks();
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);
  const [formDefaults, setFormDefaults] = useState<Partial<RecurringTaskInput> | undefined>();

  function handleCreate() {
    setEditingTask(null);
    setFormDefaults(undefined);
    setFormOpen(true);
  }

  function handleEdit(task: RecurringTask) {
    setEditingTask(task);
    setFormDefaults(undefined);
    setFormOpen(true);
  }

  function handleQuickExample(defaults: Partial<RecurringTaskInput>) {
    setEditingTask(null);
    setFormDefaults(defaults);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Header with create button */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Tareas recurrentes</h2>
          <p className="text-sm text-muted-foreground">
            Tareas que se crean automáticamente según la frecuencia definida.
          </p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">Nueva tarea recurrente</span>
          <span className="sm:hidden">Nueva</span>
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando...
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Error al cargar las tareas recurrentes. Intenta recargar la página.
        </div>
      )}

      {/* Task list */}
      {!isLoading && !isError && (
        <>
          {recurringTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
              <CalendarClock className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No hay tareas recurrentes configuradas
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Crea una o usa uno de los ejemplos de abajo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recurringTasks.map((task) => (
                <RecurringTaskCard
                  key={task.id}
                  task={task}
                  onEdit={() => handleEdit(task)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Quick examples */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            Ejemplos rápidos
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_EXAMPLES.map((ex) => (
            <Button
              key={ex.title}
              variant="outline"
              size="sm"
              onClick={() => handleQuickExample(ex.defaults)}
              className="text-xs"
            >
              {ex.title}
            </Button>
          ))}
        </div>
      </div>

      {/* Form dialog */}
      <RecurringTaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        defaultValues={formDefaults}
      />
    </div>
  );
}
