'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Archive,
  Loader2,
  BedDouble,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/use-profile';
import { useAllRooms, useRoomTypes, useRoomStatuses } from '@/hooks/use-hotel';
import { formatCurrency } from '@/lib/format';
import {
  getSupabaseErrorMessage,
  logSupabaseError,
} from '@/lib/supabase/errors';
import type { Tables } from '@/types/database';

// -------------------------------------------------------
// Schemas
// -------------------------------------------------------

const roomSchema = z.object({
  number: z.string().min(1, 'El número es requerido'),
  floor: z.string().min(1, 'El piso es requerido'),
  room_type_id: z.string().min(1, 'El tipo es requerido'),
  status_id: z.string().min(1, 'El estado es requerido'),
  housekeeping_status: z.enum(['clean', 'dirty', 'inspected']),
  notes: z.string().optional(),
});

type RoomFormValues = z.infer<typeof roomSchema>;

const bulkSchema = z.object({
  floor: z.string().min(1, 'El piso es requerido'),
  room_type_id: z.string().min(1, 'El tipo es requerido'),
  range_start: z.coerce.number().int().min(1, 'Requerido'),
  range_end: z.coerce.number().int().min(1, 'Requerido'),
}).refine((d) => d.range_end >= d.range_start, {
  message: 'El rango final debe ser mayor o igual al inicial',
  path: ['range_end'],
});

type BulkFormValues = z.infer<typeof bulkSchema>;

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function HabitacionesPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const organizationId = profile?.organization_id ?? '';
  const currency = profile?.organization?.currency ?? 'COP';
  const locale = profile?.organization?.locale ?? 'es-CO';

  const { data: rooms = [], isLoading: roomsLoading } = useAllRooms();
  const { data: roomTypes = [] } = useRoomTypes();
  const { data: roomStatuses = [] } = useRoomStatuses();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tables<'rooms'> | null>(null);
  const [filterFloor, setFilterFloor] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Default status: the one with counts_as_available = true
  const defaultStatusId = useMemo(
    () => roomStatuses.find((s) => s.counts_as_available)?.id ?? roomStatuses[0]?.id ?? '',
    [roomStatuses],
  );

  // All floors for filter
  const floors = useMemo(() => {
    const set = new Set(rooms.map((r) => r.floor).filter(Boolean));
    return Array.from(set).sort();
  }, [rooms]);

  // Filtered rooms (include inactive)
  const allRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (filterFloor !== 'all' && r.floor !== filterFloor) return false;
      if (filterType !== 'all' && r.room_type_id !== filterType) return false;
      return true;
    });
  }, [rooms, filterFloor, filterType]);

  // -------------------------------------------------------
  // Single room form
  // -------------------------------------------------------

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      number: '',
      floor: '',
      room_type_id: '',
      status_id: '',
      housekeeping_status: 'clean',
      notes: '',
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: RoomFormValues) => {
      const supabase = createClient();
      const payload = {
        number: values.number,
        floor: values.floor,
        room_type_id: values.room_type_id,
        status_id: values.status_id,
        housekeeping_status: values.housekeeping_status,
        notes: values.notes || null,
      };

      if (editTarget) {
        const { error } = await supabase
          .from('rooms')
          .update(payload)
          .eq('id', editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('rooms')
          .insert({ ...payload, organization_id: organizationId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editTarget ? 'Habitación actualizada' : 'Habitación creada');
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_all_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });
      setDialogOpen(false);
      setEditTarget(null);
      reset();
    },
    onError: (error) => {
      logSupabaseError(error, 'rooms:save');
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (room: Tables<'rooms'>) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('rooms')
        .update({ is_active: !room.is_active })
        .eq('id', room.id);
      if (error) throw error;
    },
    onSuccess: (_d, room) => {
      toast.success(room.is_active ? 'Habitación desactivada' : 'Habitación activada');
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_all_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });
    },
    onError: (error) => {
      logSupabaseError(error, 'rooms:toggleActive');
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  function openCreate() {
    setEditTarget(null);
    reset({
      number: '',
      floor: '',
      room_type_id: roomTypes[0]?.id ?? '',
      status_id: defaultStatusId,
      housekeeping_status: 'clean',
      notes: '',
    });
    setDialogOpen(true);
  }

  function openEdit(room: Tables<'rooms'>) {
    setEditTarget(room);
    reset({
      number: room.number,
      floor: room.floor ?? '',
      room_type_id: room.room_type_id,
      status_id: room.status_id,
      housekeeping_status: room.housekeeping_status as 'clean' | 'dirty' | 'inspected',
      notes: room.notes ?? '',
    });
    setDialogOpen(true);
  }

  // -------------------------------------------------------
  // Bulk creation form
  // -------------------------------------------------------

  const bulkForm = useForm<BulkFormValues>({
    resolver: zodResolver(bulkSchema),
    defaultValues: {
      floor: '',
      room_type_id: roomTypes[0]?.id ?? '',
      range_start: 101,
      range_end: 110,
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (values: BulkFormValues) => {
      const supabase = createClient();
      const rows = [];
      for (let n = values.range_start; n <= values.range_end; n++) {
        rows.push({
          organization_id: organizationId,
          number: String(n),
          floor: values.floor,
          room_type_id: values.room_type_id,
          status_id: defaultStatusId,
          housekeeping_status: 'clean' as const,
        });
      }
      const { error } = await supabase.from('rooms').insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} habitaciones creadas`);
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_all_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });
      setBulkDialogOpen(false);
      bulkForm.reset();
    },
    onError: (error) => {
      logSupabaseError(error, 'rooms:bulk');
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  // Helper to get room type/status names
  const getTypeName = (id: string) => roomTypes.find((t) => t.id === id)?.name ?? '—';
  const getTypeRate = (id: string) => roomTypes.find((t) => t.id === id)?.base_rate ?? 0;
  const getStatus = (id: string) => roomStatuses.find((s) => s.id === id);

  const housekeepingLabels: Record<string, { label: string; color: string }> = {
    clean: { label: 'Limpia', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    dirty: { label: 'Sucia', color: 'bg-red-500/15 text-red-700 dark:text-red-400' },
    inspected: { label: 'Inspeccionada', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BedDouble className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Habitaciones</h1>
            <p className="text-sm text-muted-foreground">
              {rooms.length} habitación{rooms.length !== 1 ? 'es' : ''} registrada{rooms.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)} disabled={roomTypes.length === 0}>
            <Layers className="mr-1.5 h-4 w-4" />
            Crear en lote
          </Button>
          <Button size="sm" onClick={openCreate} disabled={roomTypes.length === 0}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva
          </Button>
        </div>
      </div>

      {/* No room types warning */}
      {roomTypes.length === 0 && !roomsLoading && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Primero debes crear al menos un tipo de habitación en{' '}
          <a href="/configuracion/catalogos" className="font-medium underline">
            Configuración &gt; Catálogos
          </a>.
        </div>
      )}

      {/* Filters */}
      {rooms.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Select value={filterFloor} onValueChange={(v) => setFilterFloor(v ?? 'all')}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Piso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los pisos</SelectItem>
              {floors.map((f) => (
                <SelectItem key={f} value={f}>Piso {f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={(v) => setFilterType(v ?? 'all')}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {roomTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Room list */}
      {roomsLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : allRooms.length === 0 && rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <BedDouble className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            Aún no hay habitaciones
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea habitaciones individuales o en lote
          </p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)} disabled={roomTypes.length === 0}>
              Crear en lote
            </Button>
            <Button size="sm" onClick={openCreate} disabled={roomTypes.length === 0}>
              Crear una
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allRooms.map((room) => {
            const status = getStatus(room.status_id);
            const hk = housekeepingLabels[room.housekeeping_status] ?? housekeepingLabels.clean;
            return (
              <div
                key={room.id}
                className={`rounded-xl border bg-card p-4 shadow-sm space-y-2 ${!room.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {status?.color && (
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                    )}
                    <span className="font-bold text-lg">{room.number}</span>
                    <span className="text-xs text-muted-foreground">Piso {room.floor}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(room)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => toggleActiveMutation.mutate(room)}
                      disabled={toggleActiveMutation.isPending}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  {getTypeName(room.room_type_id)} · {formatCurrency(getTypeRate(room.room_type_id), currency, locale)}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-normal" style={{ borderColor: status?.color ?? undefined }}>
                    {status?.name ?? '—'}
                  </Badge>
                  <Badge variant="secondary" className={`text-[10px] font-normal ${hk.color}`}>
                    {hk.label}
                  </Badge>
                  {!room.is_active && (
                    <Badge variant="destructive" className="text-[10px]">Inactiva</Badge>
                  )}
                </div>

                {room.notes && (
                  <p className="text-xs text-muted-foreground truncate">{room.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===== Single room dialog ===== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? `Editar habitación ${editTarget.number}` : 'Nueva habitación'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Número *</Label>
                <Input {...register('number')} placeholder="101" />
                {errors.number && <p className="text-xs text-destructive">{errors.number.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Piso *</Label>
                <Input {...register('floor')} placeholder="1" />
                {errors.floor && <p className="text-xs text-destructive">{errors.floor.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de habitación *</Label>
              <Select value={watch('room_type_id')} onValueChange={(v) => setValue('room_type_id', v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} — {formatCurrency(t.base_rate, currency, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.room_type_id && <p className="text-xs text-destructive">{errors.room_type_id.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={watch('status_id')} onValueChange={(v) => setValue('status_id', v ?? '')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roomStatuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Limpieza</Label>
                <Select value={watch('housekeeping_status')} onValueChange={(v) => setValue('housekeeping_status', v as 'clean' | 'dirty' | 'inspected')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clean">Limpia</SelectItem>
                    <SelectItem value="dirty">Sucia</SelectItem>
                    <SelectItem value="inspected">Inspeccionada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea rows={2} {...register('notes')} placeholder="Observaciones opcionales..." />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting || saveMutation.isPending}>
                {(isSubmitting || saveMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editTarget ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== Bulk creation dialog ===== */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear habitaciones en lote</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={bulkForm.handleSubmit((v) => bulkMutation.mutate(v))}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <Label>Tipo de habitación *</Label>
              <Select
                value={bulkForm.watch('room_type_id')}
                onValueChange={(v) => bulkForm.setValue('room_type_id', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} — {formatCurrency(t.base_rate, currency, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bulkForm.formState.errors.room_type_id && (
                <p className="text-xs text-destructive">{bulkForm.formState.errors.room_type_id.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Piso *</Label>
              <Input {...bulkForm.register('floor')} placeholder="1" />
              {bulkForm.formState.errors.floor && (
                <p className="text-xs text-destructive">{bulkForm.formState.errors.floor.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Desde (número) *</Label>
                <Input type="number" {...bulkForm.register('range_start')} placeholder="101" />
                {bulkForm.formState.errors.range_start && (
                  <p className="text-xs text-destructive">{bulkForm.formState.errors.range_start.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Hasta (número) *</Label>
                <Input type="number" {...bulkForm.register('range_end')} placeholder="110" />
                {bulkForm.formState.errors.range_end && (
                  <p className="text-xs text-destructive">{bulkForm.formState.errors.range_end.message}</p>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Se crearán {Math.max(0, (bulkForm.watch('range_end') || 0) - (bulkForm.watch('range_start') || 0) + 1)} habitaciones
              con estado &quot;Disponible&quot; y limpieza &quot;Limpia&quot;.
            </p>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setBulkDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={bulkMutation.isPending}>
                {bulkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear en lote
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
