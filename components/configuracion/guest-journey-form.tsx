'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, Controller, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Variable,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import {
  createTaskTemplateAction,
  updateTaskTemplateAction,
  type TaskTemplateData,
  type CreateTaskTemplateData,
} from '@/app/actions/task-templates';
import type { TaskTemplate, RoleInfo } from '@/hooks/use-task-templates';

// -------------------------------------------------------
// Constants
// -------------------------------------------------------

const TOKEN_INSERTIONS = [
  { token: '{guest}', label: 'Nombre del huesped' },
  { token: '{room}', label: 'Habitacion' },
  { token: '{code}', label: 'Codigo de reserva' },
  { token: '{date}', label: 'Fecha' },
  { token: '{room_type}', label: 'Tipo de habitacion' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
] as const;

const PHASE_LABELS: Record<number, string> = {
  1: 'Al reservar',
  2: 'Antes de la llegada',
  3: 'Dia de llegada',
  4: 'Durante la estadia',
  5: 'Dia de salida',
  6: 'Despues de la salida',
};

// -------------------------------------------------------
// Schema
// -------------------------------------------------------

const formSchema = z.object({
  title_template: z.string().min(1, 'El titulo es obligatorio'),
  subtasks: z.array(z.object({ text: z.string().min(1, 'El paso no puede estar vacio') })),
  role_system_key: z.string().nullable(),
  priority: z.string(),
  // Timing fields
  anchor: z.string().nullable(),
  offset_days: z.number().int(),
  at_time: z.string().nullable(),
  offset_minutes: z.number().int().nullable(),
  // Conditions
  is_foreign_guest: z.boolean(),
  is_ota_channel: z.boolean(),
  has_children: z.boolean(),
  lead_time_enabled: z.boolean(),
  lead_time_days: z.number().int().min(1),
});

type FormValues = z.infer<typeof formSchema>;

// -------------------------------------------------------
// Props
// -------------------------------------------------------

export interface GuestJourneyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: TaskTemplate | null;
  phase: number;
  roles: Array<{ system_key: string; name: string; color: string }>;
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

/** Derive default anchor/offsets from phase */
function getDefaultsForPhase(phase: number): Partial<FormValues> {
  switch (phase) {
    case 1:
      return { anchor: 'created_at', offset_days: 0, at_time: null, offset_minutes: null };
    case 2:
      return { anchor: 'check_in', offset_days: -2, at_time: '10:00', offset_minutes: null };
    case 3:
      return { anchor: 'check_in', offset_days: 0, at_time: '08:00', offset_minutes: null };
    case 4:
      return { anchor: 'arrival_confirmed', offset_days: 0, at_time: null, offset_minutes: 45 };
    case 5:
      return { anchor: 'check_out', offset_days: 0, at_time: '08:00', offset_minutes: null };
    case 6:
      return { anchor: 'check_out', offset_days: 1, at_time: '10:00', offset_minutes: null };
    default:
      return { anchor: 'created_at', offset_days: 0, at_time: null, offset_minutes: null };
  }
}

/** Build conditions object from form booleans */
function buildConditions(values: FormValues): Record<string, unknown> | null {
  const conditions: Record<string, unknown> = {};

  if (values.is_foreign_guest) conditions.is_foreign_guest = true;
  if (values.is_ota_channel) conditions.is_ota_channel = true;
  if (values.has_children) conditions.has_children = true;
  if (values.lead_time_enabled && values.lead_time_days > 0) {
    conditions[`lead_time_days_gte`] = values.lead_time_days;
  }

  return Object.keys(conditions).length > 0 ? conditions : null;
}

/** Parse conditions from template back to form booleans */
function parseConditions(
  conditions: Record<string, unknown> | null,
): Pick<FormValues, 'is_foreign_guest' | 'is_ota_channel' | 'has_children' | 'lead_time_enabled' | 'lead_time_days'> {
  if (!conditions) {
    return {
      is_foreign_guest: false,
      is_ota_channel: false,
      has_children: false,
      lead_time_enabled: false,
      lead_time_days: 3,
    };
  }
  const leadTimeDays = conditions['lead_time_days_gte'];
  return {
    is_foreign_guest: Boolean(conditions.is_foreign_guest),
    is_ota_channel: Boolean(conditions.is_ota_channel),
    has_children: Boolean(conditions.has_children),
    lead_time_enabled: leadTimeDays != null,
    lead_time_days: typeof leadTimeDays === 'number' ? leadTimeDays : 3,
  };
}

/** Build summary sentence in Spanish */
function buildSummary(values: FormValues, phase: number, roles: GuestJourneyFormProps['roles']): string {
  const parts: string[] = [];

  // Timing
  if (phase === 1) {
    parts.push('Se creara al crear la reserva');
  } else if (phase === 2) {
    const days = Math.abs(values.offset_days || 0);
    const dayWord = days === 1 ? 'dia' : 'dias';
    const timeStr = values.at_time ? `, a las ${values.at_time}` : '';
    parts.push(`Se creara ${days} ${dayWord} antes de la llegada${timeStr}`);
  } else if (phase === 3) {
    if (values.at_time) {
      parts.push(`Se creara el dia de llegada a las ${values.at_time}`);
    } else {
      parts.push('Se creara al llegar el huesped');
    }
  } else if (phase === 4) {
    if (values.offset_minutes) {
      parts.push(`Se creara ${values.offset_minutes} min despues de llegar`);
    } else {
      parts.push('Se creara al confirmar la llegada');
    }
  } else if (phase === 5) {
    if (values.at_time) {
      parts.push(`Se creara el dia de salida a las ${values.at_time}`);
    } else {
      parts.push('Se creara el dia de salida');
    }
  } else if (phase === 6) {
    const days = values.offset_days || 1;
    const dayWord = days === 1 ? 'dia' : 'dias';
    const timeStr = values.at_time ? `, a las ${values.at_time}` : '';
    parts.push(`Se creara ${days} ${dayWord} despues de la salida${timeStr}`);
  }

  // Role
  const role = roles.find((r) => r.system_key === values.role_system_key);
  if (role) {
    parts.push(`para ${role.name}`);
  }

  // Steps
  const validSteps = values.subtasks.filter((s) => s.text.trim());
  if (validSteps.length > 0) {
    parts.push(`con ${validSteps.length} paso${validSteps.length !== 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function GuestJourneyForm({
  open,
  onOpenChange,
  template,
  phase,
  roles,
}: GuestJourneyFormProps) {
  const queryClient = useQueryClient();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = Boolean(template);
  const phaseDefaults = getDefaultsForPhase(phase);
  const conditionDefaults = parseConditions(template?.conditions ?? null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title_template: '',
      subtasks: [],
      role_system_key: null,
      priority: 'normal',
      anchor: phaseDefaults.anchor ?? null,
      offset_days: phaseDefaults.offset_days ?? 0,
      at_time: phaseDefaults.at_time ?? null,
      offset_minutes: phaseDefaults.offset_minutes ?? null,
      ...conditionDefaults,
    },
  });

  const { fields: subtaskFields, append: appendSubtask, remove: removeSubtask } = useFieldArray({
    control: form.control,
    name: 'subtasks',
  });

  // Reset form when template/phase changes
  useEffect(() => {
    if (!open) return;
    const defaults = getDefaultsForPhase(phase);
    const conds = parseConditions(template?.conditions ?? null);

    form.reset({
      title_template: template?.title_template ?? '',
      subtasks: template?.subtasks ?? [],
      role_system_key: template?.role_system_key ?? null,
      priority: template?.priority ?? 'normal',
      anchor: template?.anchor ?? defaults.anchor ?? null,
      offset_days: template?.offset_days ?? defaults.offset_days ?? 0,
      at_time: template?.at_time ?? defaults.at_time ?? null,
      offset_minutes: template?.offset_minutes ?? defaults.offset_minutes ?? null,
      ...conds,
    });

    // Open advanced if conditions exist
    if (template?.conditions && Object.keys(template.conditions).length > 0) {
      setAdvancedOpen(true);
    } else {
      setAdvancedOpen(false);
    }
  }, [open, template, phase, form]);

  const watchedValues = form.watch();
  const summary = buildSummary(watchedValues, phase, roles);

  function insertToken(token: string) {
    const input = titleInputRef.current;
    if (!input) {
      const current = form.getValues('title_template');
      form.setValue('title_template', current + token, { shouldDirty: true });
      return;
    }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const current = input.value;
    const newValue = current.slice(0, start) + token + current.slice(end);
    form.setValue('title_template', newValue, { shouldDirty: true });
    // Restore cursor position after the inserted token
    requestAnimationFrame(() => {
      const newPos = start + token.length;
      input.setSelectionRange(newPos, newPos);
      input.focus();
    });
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const conditions = buildConditions(values);

      const payload: TaskTemplateData = {
        title_template: values.title_template,
        subtasks: values.subtasks.length > 0 ? values.subtasks : null,
        role_system_key: values.role_system_key,
        priority: values.priority,
        anchor: values.anchor,
        offset_days: values.offset_days,
        at_time: values.at_time,
        offset_minutes: values.offset_minutes,
        conditions,
        phase: String(phase),
      };

      let result;
      if (isEditing && template) {
        result = await updateTaskTemplateAction(template.id, payload);
      } else {
        result = await createTaskTemplateAction({
          ...payload,
          title_template: values.title_template,
          priority: values.priority,
          offset_days: values.offset_days,
        } as CreateTaskTemplateData);
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditing ? 'Plantilla actualizada' : 'Plantilla creada');
        queryClient.invalidateQueries({ queryKey: ['task_templates'] });
        onOpenChange(false);
      }
    } catch {
      toast.error('Error inesperado');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Editar tarea automatica' : 'Nueva tarea automatica'}
      description={PHASE_LABELS[phase] ?? ''}
      footer={
        <div className="flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isEditing ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => e.preventDefault()}
        className="space-y-5"
      >
        {/* 1. Title with token insertion */}
        <div className="space-y-1.5">
          <Label htmlFor="title_template">Que hay que hacer?</Label>
          <div className="flex gap-1.5">
            <Controller
              control={form.control}
              name="title_template"
              render={({ field }) => (
                <Input
                  {...field}
                  ref={(el) => {
                    titleInputRef.current = el;
                    // Keep react-hook-form ref too
                    if (typeof field.ref === 'function') field.ref(el);
                  }}
                  id="title_template"
                  placeholder="Ej: Preparar habitacion {room}"
                  className="flex-1"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" size="icon" type="button" aria-label="Insertar dato" />
                }
              >
                <Variable className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-1">
                {TOKEN_INSERTIONS.map((ti) => (
                  <button
                    key={ti.token}
                    type="button"
                    onClick={() => insertToken(ti.token)}
                    className="flex w-full items-center rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    {ti.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          {form.formState.errors.title_template && (
            <p className="text-xs text-destructive">
              {form.formState.errors.title_template.message}
            </p>
          )}
        </div>

        {/* 2. Subtasks */}
        <div className="space-y-1.5">
          <Label>Pasos (checklist)</Label>
          <div className="space-y-1.5">
            {subtaskFields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-1.5">
                <span className="w-5 text-center text-xs text-muted-foreground">{index + 1}.</span>
                <Controller
                  control={form.control}
                  name={`subtasks.${index}.text`}
                  render={({ field: f }) => (
                    <Input
                      {...f}
                      placeholder="Describe el paso..."
                      className="flex-1"
                    />
                  )}
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  type="button"
                  onClick={() => removeSubtask(index)}
                  aria-label="Eliminar paso"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => appendSubtask({ text: '' })}
              className="w-full"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Agregar paso
            </Button>
          </div>
        </div>

        {/* 3. Role selector */}
        <div className="space-y-1.5">
          <Label htmlFor="role_system_key">Quien la hace?</Label>
          <Controller
            control={form.control}
            name="role_system_key"
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onValueChange={(v) => field.onChange(v === '' ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar rol..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.system_key} value={role.system_key}>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: role.color }}
                        />
                        {role.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* 4. Timing — dynamic based on phase */}
        <div className="space-y-1.5">
          <Label>Cuando?</Label>
          <TimingFields phase={phase} form={form} />
        </div>

        {/* 5. Priority */}
        <div className="space-y-1.5">
          <Label htmlFor="priority">Urgencia</Label>
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Advanced options */}
        <div className="rounded-lg border">
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex w-full items-center justify-between p-3 text-sm font-medium transition-colors hover:bg-muted/50"
          >
            Opciones avanzadas
            {advancedOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {advancedOpen && (
            <div className="space-y-3 border-t px-3 pb-3 pt-3">
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="is_foreign_guest"
                  render={({ field }) => (
                    <Checkbox
                      id="is_foreign_guest"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="is_foreign_guest" className="font-normal">
                  Huesped extranjero
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="is_ota_channel"
                  render={({ field }) => (
                    <Checkbox
                      id="is_ota_channel"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="is_ota_channel" className="font-normal">
                  Reserva de OTA
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="has_children"
                  render={({ field }) => (
                    <Checkbox
                      id="has_children"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="has_children" className="font-normal">
                  Con ninos
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="lead_time_enabled"
                  render={({ field }) => (
                    <Checkbox
                      id="lead_time_enabled"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="lead_time_enabled" className="font-normal">
                  Estadia de
                </Label>
                <Controller
                  control={form.control}
                  name="lead_time_days"
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="number"
                      min={1}
                      className="h-7 w-14 text-center text-sm"
                      disabled={!watchedValues.lead_time_enabled}
                    />
                  )}
                />
                <span className="text-sm text-muted-foreground">noches o mas</span>
              </div>
            </div>
          )}
        </div>

        {/* Live summary */}
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          {summary}
        </div>
      </form>
    </ResponsiveDialog>
  );
}

// -------------------------------------------------------
// Timing fields sub-component (varies by phase)
// -------------------------------------------------------

function TimingFields({
  phase,
  form,
}: {
  phase: number;
  form: UseFormReturn<FormValues>;
}) {
  // Phase 1: Al reservar — just a static label, optionally delay in minutes
  if (phase === 1) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Al crear la reserva</p>
        <div className="flex items-center gap-2">
          <Label htmlFor="offset_minutes_1" className="text-xs font-normal text-muted-foreground">
            Retraso (opcional):
          </Label>
          <Controller
            control={form.control}
            name="offset_minutes"
            render={({ field }) => (
              <Input
                {...field}
                id="offset_minutes_1"
                type="number"
                min={0}
                placeholder="0"
                className="h-7 w-20 text-center text-sm"
                value={field.value ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  field.onChange(v === '' ? null : Number(v));
                }}
              />
            )}
          />
          <span className="text-xs text-muted-foreground">minutos</span>
        </div>
      </div>
    );
  }

  // Phase 2: Antes de la llegada — X days before check_in at HH:MM
  if (phase === 2) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Controller
          control={form.control}
          name="offset_days"
          render={({ field }) => (
            <Input
              {...field}
              type="number"
              max={0}
              className="h-7 w-16 text-center text-sm"
              value={Math.abs(field.value || 0)}
              onChange={(e) => field.onChange(-Math.abs(Number(e.target.value)))}
            />
          )}
        />
        <span className="text-sm">dias antes de la llegada, a las</span>
        <Controller
          control={form.control}
          name="at_time"
          render={({ field }) => (
            <Input
              {...field}
              type="time"
              className="h-7 w-28 text-sm"
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value || null)}
            />
          )}
        />
      </div>
    );
  }

  // Phase 3: Dia de llegada — at HH:MM or "when guest arrives"
  if (phase === 3) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">El dia de llegada a las</span>
        <Controller
          control={form.control}
          name="at_time"
          render={({ field }) => (
            <Input
              {...field}
              type="time"
              className="h-7 w-28 text-sm"
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value || null)}
            />
          )}
        />
        <span className="text-xs text-muted-foreground">(dejar vacio = al llegar el huesped)</span>
      </div>
    );
  }

  // Phase 4: Durante la estadia — X minutes after arrival_confirmed
  if (phase === 4) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Controller
          control={form.control}
          name="offset_minutes"
          render={({ field }) => (
            <Input
              {...field}
              type="number"
              min={0}
              className="h-7 w-20 text-center text-sm"
              value={field.value ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                field.onChange(v === '' ? null : Number(v));
              }}
            />
          )}
        />
        <span className="text-sm">minutos despues de llegar</span>
      </div>
    );
  }

  // Phase 5: Dia de salida — at HH:MM
  if (phase === 5) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">El dia de salida a las</span>
        <Controller
          control={form.control}
          name="at_time"
          render={({ field }) => (
            <Input
              {...field}
              type="time"
              className="h-7 w-28 text-sm"
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value || null)}
            />
          )}
        />
      </div>
    );
  }

  // Phase 6: Despues de la salida — X days after check_out at HH:MM
  if (phase === 6) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Controller
          control={form.control}
          name="offset_days"
          render={({ field }) => (
            <Input
              {...field}
              type="number"
              min={0}
              className="h-7 w-16 text-center text-sm"
              value={Math.abs(field.value || 0)}
              onChange={(e) => field.onChange(Math.abs(Number(e.target.value)))}
            />
          )}
        />
        <span className="text-sm">dias despues de la salida, a las</span>
        <Controller
          control={form.control}
          name="at_time"
          render={({ field }) => (
            <Input
              {...field}
              type="time"
              className="h-7 w-28 text-sm"
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value || null)}
            />
          )}
        />
      </div>
    );
  }

  return null;
}
