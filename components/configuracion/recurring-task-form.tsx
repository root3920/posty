'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import {
  recurringTaskSchema,
  type RecurringTaskInput,
} from '@/lib/validations/recurring-tasks';
import { getNextOccurrences } from '@/lib/recurring-dates';
import type { RecurringTask } from '@/hooks/use-recurring-tasks';
import {
  useCreateRecurringTask,
  useUpdateRecurringTask,
} from '@/hooks/use-recurring-tasks';

import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { EntitySelect, type EntityOption } from '@/components/shared/entity-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface RecurringTaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: RecurringTask | null;
  defaultValues?: Partial<RecurringTaskInput>;
}

// -------------------------------------------------------
// Day chips for weekly
// -------------------------------------------------------

const WEEKDAYS = [
  { iso: 1, label: 'L' },
  { iso: 2, label: 'M' },
  { iso: 3, label: 'X' },
  { iso: 4, label: 'J' },
  { iso: 5, label: 'V' },
  { iso: 6, label: 'S' },
  { iso: 7, label: 'D' },
] as const;

// -------------------------------------------------------
// Priority labels
// -------------------------------------------------------

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

// -------------------------------------------------------
// Data fetching
// -------------------------------------------------------

async function fetchRoles(): Promise<EntityOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('roles')
    .select('id, name, color')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    value: r.id,
    label: r.name,
    color: r.color ?? undefined,
  }));
}

async function fetchTeamMembers(): Promise<EntityOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, job_title')
    .eq('is_active', true)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    value: p.id,
    label: p.full_name,
    description: p.job_title ?? undefined,
  }));
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function RecurringTaskForm({
  open,
  onOpenChange,
  task,
  defaultValues: externalDefaults,
}: RecurringTaskFormProps) {
  const isEditing = !!task;

  // Fetch roles & team members
  const rolesQuery = useQuery({
    queryKey: ['roles_select'],
    queryFn: fetchRoles,
    staleTime: 5 * 60 * 1000,
  });

  const teamQuery = useQuery({
    queryKey: ['team_members_select'],
    queryFn: fetchTeamMembers,
    staleTime: 5 * 60 * 1000,
  });

  // Mutations
  const createMutation = useCreateRecurringTask();
  const updateMutation = useUpdateRecurringTask();

  // Form — use z.output type to match zod defaults
  const form = useForm<RecurringTaskInput>({
    resolver: zodResolver(recurringTaskSchema) as never,
    defaultValues: {
      title: '',
      description: '',
      subtasks: [],
      assigned_role_id: null,
      assigned_profile_id: null,
      room_id: null,
      frequency_type: 'daily',
      frequency_config: {},
      at_time: '09:00',
      priority: 'normal',
      start_date: null,
      end_date: null,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'subtasks',
  });

  // Reset form when opening
  useEffect(() => {
    if (!open) return;

    if (task) {
      form.reset({
        title: task.title,
        description: task.description ?? '',
        subtasks: (task.subtasks ?? []) as { text: string }[],
        assigned_role_id: task.assigned_role_id,
        assigned_profile_id: task.assigned_profile_id,
        room_id: task.room_id,
        frequency_type: task.frequency_type,
        frequency_config: task.frequency_config,
        at_time: task.at_time,
        priority: task.priority,
        start_date: task.start_date,
        end_date: task.end_date,
      });
    } else {
      form.reset({
        title: externalDefaults?.title ?? '',
        description: externalDefaults?.description ?? '',
        subtasks: externalDefaults?.subtasks ?? [],
        assigned_role_id: externalDefaults?.assigned_role_id ?? null,
        assigned_profile_id: externalDefaults?.assigned_profile_id ?? null,
        room_id: externalDefaults?.room_id ?? null,
        frequency_type: externalDefaults?.frequency_type ?? 'daily',
        frequency_config: externalDefaults?.frequency_config ?? {},
        at_time: externalDefaults?.at_time ?? '09:00',
        priority: externalDefaults?.priority ?? 'normal',
        start_date: externalDefaults?.start_date ?? null,
        end_date: externalDefaults?.end_date ?? null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task, externalDefaults]);

  // Watch values for preview & conditional fields
  const frequencyType = form.watch('frequency_type');
  const frequencyConfig = form.watch('frequency_config');
  const atTime = form.watch('at_time');
  const assignedRoleId = form.watch('assigned_role_id');
  const assignedProfileId = form.watch('assigned_profile_id');

  // Assignment mode: 'role' or 'person'
  const assignMode = assignedProfileId ? 'person' : 'role';

  // Next occurrences preview
  const nextDates = useMemo(() => {
    try {
      return getNextOccurrences(
        {
          frequency_type: frequencyType,
          frequency_config: frequencyConfig ?? {},
          at_time: atTime || '09:00',
        },
        3,
      );
    } catch {
      return [];
    }
  }, [frequencyType, frequencyConfig, atTime]);

  // Weekly days helper
  const selectedDays = ((frequencyConfig?.days_of_week ?? []) as number[]);

  function toggleDay(day: number) {
    const current = [...selectedDays];
    const idx = current.indexOf(day);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(day);
      current.sort((a, b) => a - b);
    }
    form.setValue('frequency_config', { days_of_week: current }, { shouldValidate: true });
  }

  // Submit
  async function onSubmit(values: RecurringTaskInput) {
    try {
      // Clean up assignment: only one of role or profile
      const payload: Record<string, unknown> = {
        ...values,
        subtasks: values.subtasks.length > 0 ? values.subtasks.filter((s) => s.text.trim()) : null,
        description: values.description || null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        room_id: values.room_id || null,
      };

      if (isEditing) {
        await updateMutation.mutateAsync({ id: task.id, data: payload });
        toast.success('Tarea recurrente actualizada');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Tarea recurrente creada');
      }

      onOpenChange(false);
    } catch (err) {
      toast.error(
        isEditing
          ? 'Error al actualizar la tarea recurrente'
          : 'Error al crear la tarea recurrente',
      );
      console.error(err);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Editar tarea recurrente' : 'Nueva tarea recurrente'}
      description="Define una tarea que se creará automáticamente según la frecuencia."
      footer={
        <div className="flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {isEditing ? 'Guardar cambios' : 'Crear tarea'}
          </Button>
        </div>
      }
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
      >
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="rt-title">¿Qué hay que hacer?</Label>
          <Input
            id="rt-title"
            placeholder="Ej: Revisar extintores"
            {...form.register('title')}
            aria-invalid={!!form.formState.errors.title}
          />
          {form.formState.errors.title && (
            <p className="text-xs text-destructive">
              {form.formState.errors.title.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="rt-desc">Descripción (opcional)</Label>
          <Textarea
            id="rt-desc"
            placeholder="Instrucciones adicionales..."
            rows={2}
            {...form.register('description')}
          />
        </div>

        {/* Subtasks / Steps */}
        <div className="space-y-1.5">
          <Label>Pasos (opcional)</Label>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  placeholder={`Paso ${index + 1}`}
                  {...form.register(`subtasks.${index}.text`)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ text: '' })}
            className="mt-1"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Agregar paso
          </Button>
        </div>

        {/* Assignment */}
        <div className="space-y-1.5">
          <Label>¿Quién la hace?</Label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                assignMode === 'role'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
              onClick={() => {
                form.setValue('assigned_profile_id', null);
                form.setValue('assigned_role_id', assignedRoleId ?? null);
              }}
            >
              Por rol
            </button>
            <button
              type="button"
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                assignMode === 'person'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
              onClick={() => {
                form.setValue('assigned_role_id', null);
                form.setValue('assigned_profile_id', assignedProfileId ?? null);
              }}
            >
              Persona específica
            </button>
          </div>

          {assignMode === 'role' ? (
            <EntitySelect
              options={rolesQuery.data ?? []}
              value={assignedRoleId}
              onChange={(v) => form.setValue('assigned_role_id', v, { shouldValidate: true })}
              placeholder="Seleccionar rol..."
              isLoading={rolesQuery.isLoading}
              allowClear
              clearLabel="Sin asignar"
            />
          ) : (
            <EntitySelect
              options={teamQuery.data ?? []}
              value={assignedProfileId}
              onChange={(v) => form.setValue('assigned_profile_id', v, { shouldValidate: true })}
              placeholder="Seleccionar persona..."
              isLoading={teamQuery.isLoading}
              allowClear
              clearLabel="Sin asignar"
            />
          )}
        </div>

        {/* Frequency */}
        <div className="space-y-1.5">
          <Label>¿Cada cuánto?</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                { value: 'daily', label: 'Todos los días' },
                { value: 'weekly', label: 'Días de la semana' },
                { value: 'monthly_day', label: 'Cada mes el día...' },
                { value: 'every_n_days', label: 'Cada N días' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm text-left transition-colors',
                  frequencyType === opt.value
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-foreground hover:bg-muted',
                )}
                onClick={() => {
                  form.setValue('frequency_type', opt.value);
                  // Reset config when switching
                  if (opt.value === 'daily') {
                    form.setValue('frequency_config', {});
                  } else if (opt.value === 'weekly') {
                    form.setValue('frequency_config', { days_of_week: [] });
                  } else if (opt.value === 'monthly_day') {
                    form.setValue('frequency_config', { day_of_month: 1 });
                  } else if (opt.value === 'every_n_days') {
                    form.setValue('frequency_config', { every_n: 7 });
                  }
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Weekly day chips */}
          {frequencyType === 'weekly' && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => toggleDay(d.iso)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    selectedDays.includes(d.iso)
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'border border-border bg-background text-foreground hover:bg-muted',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {/* Monthly day input */}
          {frequencyType === 'monthly_day' && (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-sm text-muted-foreground">Día del mes:</span>
              <Input
                type="number"
                min={1}
                max={31}
                className="w-20"
                value={(frequencyConfig?.day_of_month as number) ?? 1}
                onChange={(e) =>
                  form.setValue(
                    'frequency_config',
                    { day_of_month: Math.min(31, Math.max(1, Number(e.target.value) || 1)) },
                    { shouldValidate: true },
                  )
                }
              />
            </div>
          )}

          {/* Every N days input */}
          {frequencyType === 'every_n_days' && (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-sm text-muted-foreground">Cada</span>
              <Input
                type="number"
                min={2}
                max={365}
                className="w-20"
                value={(frequencyConfig?.every_n as number) ?? 7}
                onChange={(e) =>
                  form.setValue(
                    'frequency_config',
                    { every_n: Math.min(365, Math.max(2, Number(e.target.value) || 2)) },
                    { shouldValidate: true },
                  )
                }
              />
              <span className="text-sm text-muted-foreground">días</span>
            </div>
          )}
        </div>

        {/* Time */}
        <div className="space-y-1.5">
          <Label htmlFor="rt-time">¿A qué hora?</Label>
          <Input
            id="rt-time"
            type="time"
            className="w-32"
            {...form.register('at_time')}
          />
        </div>

        {/* Date range */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rt-start">¿Desde cuándo? (opcional)</Label>
            <Input
              id="rt-start"
              type="date"
              {...form.register('start_date')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rt-end">¿Hasta cuándo? (opcional)</Label>
            <Input
              id="rt-end"
              type="date"
              {...form.register('end_date')}
            />
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-1.5">
          <Label>Urgencia</Label>
          <Select
            value={form.watch('priority')}
            onValueChange={(v) =>
              form.setValue('priority', v as RecurringTaskInput['priority'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {PRIORITY_LABELS[form.watch('priority')] ?? 'Normal'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baja</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Preview next dates */}
        {nextDates.length > 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Próximas fechas:
            </p>
            <p className="text-sm text-foreground">
              {nextDates
                .map((d) => format(d, "EEE d MMM HH:mm", { locale: es }))
                .join(' · ')}
            </p>
          </div>
        )}
      </form>
    </ResponsiveDialog>
  );
}
