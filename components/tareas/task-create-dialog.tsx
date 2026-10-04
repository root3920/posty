'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarIcon, X } from 'lucide-react';

import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EntitySelect } from '@/components/shared/entity-select';

import { Repeat } from 'lucide-react';
import { z } from 'zod';
import { createTaskSchema, type CreateTaskInput } from '@/lib/validations/tasks';
import { createTaskAction } from '@/app/actions/tasks';
import { createRecurringTaskAction } from '@/app/actions/recurring-tasks';
import { useTasks } from '@/hooks/use-tasks';
import { PRIORITY_CONFIG } from './task-shared';

const REPEAT_OPTIONS = [
  { value: 'none', label: 'No se repite' },
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
] as const;

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const DAY_ISO = [1, 2, 3, 4, 5, 6, 7] as const;

// The "input" shape (before Zod defaults are applied) — used as form values type
type CreateTaskFormValues = z.input<typeof createTaskSchema>;

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatusId?: string;
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

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function TaskCreateDialog({ open, onOpenChange, defaultStatusId }: TaskCreateDialogProps) {
  const queryClient = useQueryClient();
  const { statuses, labels, teamMembers } = useTasks();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repeatType, setRepeatType] = useState<string>('none');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatTime, setRepeatTime] = useState('08:00');
  const [repeatDayOfMonth, setRepeatDayOfMonth] = useState(1);

  const defaultStatus = defaultStatusId ?? statuses[0]?.id ?? '';

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      statusId: defaultStatus,
      priority: 'normal',
      assigneeIds: [],
      labelIds: [],
      dueDate: null,
      startDate: null,
    },
  });

  // Set default status when statuses load (they may arrive after form init)
  const watchStatusId = watch('statusId');
  useEffect(() => {
    if (!watchStatusId && statuses.length > 0) {
      setValue('statusId', defaultStatusId ?? statuses[0].id);
    }
  }, [statuses, watchStatusId, defaultStatusId, setValue]);

  const selectedAssigneeIds = watch('assigneeIds') ?? [];
  const selectedLabelIds = watch('labelIds') ?? [];

  function toggleAssignee(id: string) {
    const current = selectedAssigneeIds;
    if (current.includes(id)) {
      setValue('assigneeIds', current.filter((a) => a !== id));
    } else {
      setValue('assigneeIds', [...current, id]);
    }
  }

  function toggleLabel(id: string) {
    const current = selectedLabelIds;
    if (current.includes(id)) {
      setValue('labelIds', current.filter((l) => l !== id));
    } else {
      setValue('labelIds', [...current, id]);
    }
  }

  const repeatConfig = useMemo(() => {
    if (repeatType === 'none') return null;
    if (repeatType === 'daily') return { frequency_type: 'daily', frequency_config: {} };
    if (repeatType === 'weekly') return { frequency_type: 'weekly', frequency_config: { days_of_week: repeatDays.length > 0 ? repeatDays : [1, 2, 3, 4, 5] } };
    if (repeatType === 'monthly') return { frequency_type: 'monthly_day', frequency_config: { day_of_month: repeatDayOfMonth } };
    return null;
  }, [repeatType, repeatDays, repeatDayOfMonth]);

  async function onSubmit(data: CreateTaskFormValues) {
    setServerError(null);
    setIsSubmitting(true);
    try {
      // Create the task
      const result = await createTaskAction(data as CreateTaskInput);
      if (result.error) {
        setServerError(result.error);
        return;
      }

      // Also create a recurring task if repeat is set
      if (repeatConfig) {
        await createRecurringTaskAction({
          title: data.title,
          description: data.description || undefined,
          ...repeatConfig,
          at_time: repeatTime,
          priority: data.priority || 'normal',
        });
        await queryClient.invalidateQueries({ queryKey: ['recurring_tasks'] });
      }

      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      reset();
      setRepeatType('none');
      setRepeatDays([]);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  const dialogFooter = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          reset();
          onOpenChange(false);
        }}
        disabled={isSubmitting}
      >
        Cancelar
      </Button>
      <Button type="submit" form="task-create-form" disabled={isSubmitting}>
        {isSubmitting ? 'Creando…' : 'Crear tarea'}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Crear tarea"
      footer={dialogFooter}
    >
        <form id="task-create-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="¿Qué hay que hacer?"
              {...register('title')}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              rows={3}
              placeholder="Descripción opcional…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('description')}
            />
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 min-w-0">
              <Label>Estado</Label>
              <Controller
                control={control}
                name="statusId"
                render={({ field }) => (
                  <EntitySelect
                    options={statuses.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? '')}
                    placeholder="Seleccionar estado"
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: cfg.color }}
                            />
                            {cfg.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Fecha de vencimiento</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="dueDate"
                type="date"
                className="pl-9"
                {...register('dueDate')}
              />
            </div>
          </div>

          {/* Repetir */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5" />
              Repetir
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {REPEAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRepeatType(opt.value)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    repeatType === opt.value
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {repeatType === 'weekly' && (
              <div className="flex gap-1">
                {DAY_LABELS.map((label, i) => {
                  const iso = DAY_ISO[i];
                  const selected = repeatDays.includes(iso);
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() =>
                        setRepeatDays((prev) =>
                          selected ? prev.filter((d) => d !== iso) : [...prev, iso],
                        )
                      }
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {repeatType === 'monthly' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">El día</span>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={repeatDayOfMonth}
                  onChange={(e) => setRepeatDayOfMonth(parseInt(e.target.value) || 1)}
                  className="w-16 tabular-nums"
                />
                <span className="text-muted-foreground">de cada mes</span>
              </div>
            )}

            {repeatType !== 'none' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">A las</span>
                <Input
                  type="time"
                  value={repeatTime}
                  onChange={(e) => setRepeatTime(e.target.value)}
                  className="w-28 tabular-nums"
                />
              </div>
            )}
          </div>

          {/* Assignees */}
          <div className="space-y-1.5">
            <Label>Asignados</Label>
            <div className="flex flex-wrap gap-1.5">
              {teamMembers.map((member) => {
                const isSelected = selectedAssigneeIds.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleAssignee(member.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <Avatar className="h-4 w-4">
                      {member.avatar_url && (
                        <AvatarImage src={member.avatar_url} alt={member.full_name} />
                      )}
                      <AvatarFallback className="text-[8px]">
                        {initials(member.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    {member.full_name.split(' ')[0]}
                    {isSelected && <X className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Labels */}
          {labels.length > 0 && (
            <div className="space-y-1.5">
              <Label>Etiquetas</Label>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => {
                  const isSelected = selectedLabelIds.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => toggleLabel(label.id)}
                      className="focus:outline-none"
                    >
                      <Badge
                        variant={isSelected ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        style={
                          isSelected
                            ? {
                                backgroundColor: label.color,
                                borderColor: label.color,
                                color: '#fff',
                              }
                            : {
                                borderColor: `${label.color}60`,
                                color: label.color,
                              }
                        }
                      >
                        {label.name}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {serverError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {serverError}
            </p>
          )}
        </form>
    </ResponsiveDialog>
  );
}
