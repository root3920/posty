'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/use-profile';
import type { Tables } from '@/types/database';

// -------------------------------------------------------
// Schema
// -------------------------------------------------------

const shiftSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  start_time: z.string().min(1, 'La hora de inicio es requerida'),
  end_time: z.string().min(1, 'La hora de fin es requerida'),
});

type ShiftFormValues = z.infer<typeof shiftSchema>;

type ShiftTemplate = Tables<'shift_templates'>;

// -------------------------------------------------------
// Fetch
// -------------------------------------------------------

async function fetchShiftTemplates(): Promise<ShiftTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('shift_templates')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function HorariosPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const orgId = profile?.organization_id;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ShiftTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ShiftTemplate | null>(null);

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shift_templates'],
    queryFn: fetchShiftTemplates,
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { name: '', start_time: '08:00', end_time: '16:00' },
  });

  // -------------------------------------------------------
  // Mutations
  // -------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: async (values: ShiftFormValues) => {
      const supabase = createClient();
      if (editTarget) {
        const { error } = await supabase
          .from('shift_templates')
          .update({ name: values.name, start_time: values.start_time, end_time: values.end_time })
          .eq('id', editTarget.id);
        if (error) throw error;
      } else {
        if (!orgId) throw new Error('No organization');
        const { error } = await supabase.from('shift_templates').insert({
          organization_id: orgId,
          name: values.name,
          start_time: values.start_time,
          end_time: values.end_time,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editTarget ? 'Turno actualizado' : 'Turno creado');
      queryClient.invalidateQueries({ queryKey: ['shift_templates'] });
      setDialogOpen(false);
      setEditTarget(null);
      reset({ name: '', start_time: '08:00', end_time: '16:00' });
    },
    onError: () => toast.error('Error al guardar el turno'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from('shift_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Turno eliminado');
      queryClient.invalidateQueries({ queryKey: ['shift_templates'] });
      setConfirmDelete(null);
    },
    onError: () => toast.error('Error al eliminar el turno'),
  });

  // -------------------------------------------------------
  // Handlers
  // -------------------------------------------------------

  function openCreate() {
    setEditTarget(null);
    reset({ name: '', start_time: '08:00', end_time: '16:00' });
    setDialogOpen(true);
  }

  function openEdit(shift: ShiftTemplate) {
    setEditTarget(shift);
    reset({
      name: shift.name,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
    });
    setDialogOpen(true);
  }

  const onSubmit = (values: ShiftFormValues) => saveMutation.mutate(values);

  function formatTime(t: string) {
    return t.slice(0, 5);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Horarios y turnos</h1>
            <p className="text-sm text-muted-foreground">
              Plantillas de turnos para asignar a empleados
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nuevo turno
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Clock className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">No hay turnos configurados</p>
          <Button variant="link" size="sm" className="mt-2" onClick={openCreate}>
            Crear primer turno
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4 shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{shift.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => openEdit(shift)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(shift)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Editar turno' : 'Nuevo turno'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="shift-name">Nombre</Label>
              <Input
                id="shift-name"
                placeholder="Ej: Mañana, Tarde, Noche…"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="start-time">Hora inicio</Label>
                <Input id="start-time" type="time" {...register('start_time')} />
                {errors.start_time && (
                  <p className="text-xs text-destructive">{errors.start_time.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-time">Hora fin</Label>
                <Input id="end-time" type="time" {...register('end_time')} />
                {errors.end_time && (
                  <p className="text-xs text-destructive">{errors.end_time.message}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || saveMutation.isPending}>
                {(isSubmitting || saveMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editTarget ? 'Guardar cambios' : 'Crear turno'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar turno?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            El turno <strong>{confirmDelete?.name}</strong> será eliminado permanentemente.
            Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
