'use client';

import { useState, Fragment, type ReactNode } from 'react';
import {
  CalendarPlus,
  CalendarClock,
  LogIn,
  Bed,
  LogOut,
  Star,
  Pencil,
  Plus,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import {
  useTaskTemplates,
  useToggleTemplate,
  useResetDefaultTemplates,
  type TaskTemplate,
  type RoleInfo,
} from '@/hooks/use-task-templates';
import { GuestJourneyForm } from './guest-journey-form';

// -------------------------------------------------------
// Constants
// -------------------------------------------------------

const JOURNEY_MOMENTS = [
  { phase: 1, label: 'Al reservar', icon: CalendarPlus, color: '#6366f1' },
  { phase: 2, label: 'Antes de la llegada', icon: CalendarClock, color: '#8b5cf6' },
  { phase: 3, label: 'Dia de llegada', icon: LogIn, color: '#06b6d4' },
  { phase: 4, label: 'Durante la estadia', icon: Bed, color: '#10b981' },
  { phase: 5, label: 'Dia de salida', icon: LogOut, color: '#f59e0b' },
  { phase: 6, label: 'Despues de la salida', icon: Star, color: '#ef4444' },
] as const;

const TOKEN_LABELS: Record<string, string> = {
  '{guest}': 'Nombre del huesped',
  '{room}': 'Habitacion',
  '{code}': 'Codigo de reserva',
  '{date}': 'Fecha',
  '{room_type}': 'Tipo de habitacion',
};

const TOKEN_COLORS: Record<string, string> = {
  '{guest}': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  '{room}': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  '{code}': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  '{date}': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  '{room_type}': 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

/** Splits a title_template into text and token Badge nodes */
function renderTitle(titleTemplate: string): ReactNode {
  const tokenRegex = /(\{guest\}|\{room\}|\{code\}|\{date\}|\{room_type\})/g;
  const parts = titleTemplate.split(tokenRegex);

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {parts.map((part, i) => {
        const label = TOKEN_LABELS[part];
        if (label) {
          return (
            <span
              key={i}
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${TOKEN_COLORS[part] ?? ''}`}
            >
              {label}
            </span>
          );
        }
        return part ? <span key={i}>{part}</span> : null;
      })}
    </span>
  );
}

/** Converts anchor/offset_days/at_time/offset_minutes into human-readable Spanish text */
function describeTiming(template: TaskTemplate): string {
  const { anchor, offset_days, at_time, offset_minutes } = template;

  if (anchor === 'created_at' && offset_days === 0) {
    return 'Al crear la reserva';
  }

  if (anchor === 'arrival_confirmed') {
    if (offset_minutes && offset_minutes > 0) {
      return `${offset_minutes} min despues de llegar`;
    }
    return 'Al confirmar la llegada';
  }

  if (anchor === 'check_in') {
    if (offset_days < 0) {
      const days = Math.abs(offset_days);
      const dayWord = days === 1 ? 'dia' : 'dias';
      const timeStr = at_time ? `, a las ${at_time.slice(0, 5)}` : '';
      return `${days} ${dayWord} antes de la llegada${timeStr}`;
    }
    if (offset_days === 0) {
      if (at_time) {
        return `El dia de llegada a las ${at_time.slice(0, 5)}`;
      }
      return 'Al llegar el huesped';
    }
    if (offset_days > 0) {
      const days = offset_days;
      const dayWord = days === 1 ? 'dia' : 'dias';
      const timeStr = at_time ? `, a las ${at_time.slice(0, 5)}` : '';
      return `${days} ${dayWord} despues de la llegada${timeStr}`;
    }
  }

  if (anchor === 'check_out') {
    if (offset_days < 0) {
      const days = Math.abs(offset_days);
      const dayWord = days === 1 ? 'dia' : 'dias';
      const timeStr = at_time ? `, a las ${at_time.slice(0, 5)}` : '';
      return `${days} ${dayWord} antes de la salida${timeStr}`;
    }
    if (offset_days === 0) {
      if (at_time) {
        return `El dia de salida a las ${at_time.slice(0, 5)}`;
      }
      return 'El dia de salida';
    }
    if (offset_days > 0) {
      const days = offset_days;
      const dayWord = days === 1 ? 'dia' : 'dias';
      const timeStr = at_time ? `, a las ${at_time.slice(0, 5)}` : '';
      return `${days} ${dayWord} despues de la salida${timeStr}`;
    }
  }

  // Fallback
  const timeStr = at_time ? ` a las ${at_time.slice(0, 5)}` : '';
  return `${anchor ?? 'Sin ancla'}${timeStr}`;
}

/** Group templates by phase number */
function groupByPhase(templates: TaskTemplate[]): Record<number, TaskTemplate[]> {
  const groups: Record<number, TaskTemplate[]> = {};
  for (const moment of JOURNEY_MOMENTS) {
    groups[moment.phase] = [];
  }
  for (const t of templates) {
    const phase = Number(t.phase);
    if (phase >= 1 && phase <= 6) {
      groups[phase].push(t);
    }
  }
  return groups;
}

/** Find the role info by system_key */
function findRole(roles: RoleInfo[], systemKey: string | null): RoleInfo | undefined {
  if (!systemKey) return undefined;
  return roles.find((r) => r.system_key === systemKey);
}

// -------------------------------------------------------
// Sub-components
// -------------------------------------------------------

function TemplateCard({
  template,
  roles,
  onEdit,
  onToggle,
  isToggling,
}: {
  template: TaskTemplate;
  roles: RoleInfo[];
  onEdit: (t: TaskTemplate) => void;
  onToggle: (id: string, active: boolean) => void;
  isToggling: boolean;
}) {
  const role = findRole(roles, template.role_system_key);

  return (
    <div
      className={`group relative rounded-lg border bg-card p-3 transition-all hover:shadow-sm ${
        !template.is_active ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Title with tokens */}
          <p className="text-sm font-medium leading-snug">
            {renderTitle(template.title_template)}
          </p>

          {/* Timing + role */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {describeTiming(template)}
            </span>
            {role && (
              <Badge
                variant="secondary"
                className="text-[11px]"
                style={{
                  backgroundColor: `${role.color}20`,
                  color: role.color,
                  borderColor: `${role.color}40`,
                }}
              >
                {role.name}
              </Badge>
            )}
          </div>

          {/* Subtasks count */}
          {template.subtasks && template.subtasks.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {template.subtasks.length} paso{template.subtasks.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onEdit(template)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Editar plantilla"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Switch
            checked={template.is_active}
            onCheckedChange={(checked) => onToggle(template.id, checked)}
            disabled={isToggling}
            aria-label={template.is_active ? 'Pausar tarea' : 'Activar tarea'}
          />
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Main component
// -------------------------------------------------------

export function GuestJourneyTab() {
  const { templates, roles, isLoading, isError } = useTaskTemplates();
  const toggleMutation = useToggleTemplate();
  const resetMutation = useResetDefaultTemplates();

  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formPhase, setFormPhase] = useState(1);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const grouped = groupByPhase(templates);

  function handleEdit(template: TaskTemplate) {
    setEditingTemplate(template);
    setFormPhase(Number(template.phase) || 1);
    setFormOpen(true);
  }

  function handleAddNew(phase: number) {
    setEditingTemplate(null);
    setFormPhase(phase);
    setFormOpen(true);
  }

  function handleToggle(id: string, isActive: boolean) {
    toggleMutation.mutate(
      { id, isActive },
      {
        onSuccess: () => {
          toast.success(isActive ? 'Tarea activada' : 'Tarea pausada');
        },
        onError: () => {
          toast.error('Error al cambiar el estado');
        },
      },
    );
  }

  function handleReset() {
    resetMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success('Plantillas restauradas a sus valores por defecto');
        setConfirmResetOpen(false);
      },
      onError: () => {
        toast.error('Error al restaurar las plantillas');
        setConfirmResetOpen(false);
      },
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Error al cargar las plantillas de tareas. Intenta recargar la pagina.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tareas que se crean automaticamente en cada momento de la estadia del huesped.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmResetOpen(true)}
          disabled={resetMutation.isPending}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Restaurar por defecto
        </Button>
      </div>

      {/* Timeline */}
      <div className="relative ml-4 border-l-2 border-border pl-6 sm:ml-6 sm:pl-8">
        {JOURNEY_MOMENTS.map((moment, idx) => {
          const Icon = moment.icon;
          const phaseTemplates = grouped[moment.phase] ?? [];
          const isLast = idx === JOURNEY_MOMENTS.length - 1;

          return (
            <div key={moment.phase} className={isLast ? 'pb-0' : 'pb-8'}>
              {/* Timeline dot */}
              <div
                className="absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-background sm:-left-[13px]"
                style={{ backgroundColor: moment.color }}
              >
                <Icon className="h-3 w-3 text-white" />
              </div>

              {/* Section header */}
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-heading text-base font-semibold">{moment.label}</h3>
                <Badge variant="secondary" className="text-[11px]">
                  {phaseTemplates.length}
                </Badge>
              </div>

              {/* Template cards */}
              <div className="space-y-2">
                {phaseTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    roles={roles}
                    onEdit={handleEdit}
                    onToggle={handleToggle}
                    isToggling={toggleMutation.isPending}
                  />
                ))}

                {/* Add new button */}
                <button
                  type="button"
                  onClick={() => handleAddNew(moment.phase)}
                  className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar tarea aqui
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit/Create form dialog */}
      <GuestJourneyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editingTemplate}
        phase={formPhase}
        roles={roles}
      />

      {/* Confirm reset dialog */}
      <ResponsiveDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="Restaurar tareas por defecto"
        description="Esto eliminara todas las plantillas actuales y las reemplazara con las predeterminadas. Esta accion no se puede deshacer."
        footer={
          <div className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setConfirmResetOpen(false)}
              disabled={resetMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Restaurar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Se eliminaran <strong>{templates.length}</strong> plantilla{templates.length !== 1 ? 's' : ''} actual{templates.length !== 1 ? 'es' : ''} y se crearan las tareas por defecto del sistema.
        </p>
      </ResponsiveDialog>
    </div>
  );
}
