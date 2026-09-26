'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarIcon, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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

import { z } from 'zod';
import { createTaskSchema, type CreateTaskInput } from '@/lib/validations/tasks';
import { createTaskAction } from '@/app/actions/tasks';
import { useTasks } from '@/hooks/use-tasks';
import { PRIORITY_CONFIG } from './task-shared';

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

  async function onSubmit(data: CreateTaskFormValues) {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const result = await createTaskAction(data as CreateTaskInput);
      if (result.error) {
        setServerError(result.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      reset();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear tarea</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Controller
                control={control}
                name="statusId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            {s.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

          <DialogFooter>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando…' : 'Crear tarea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
