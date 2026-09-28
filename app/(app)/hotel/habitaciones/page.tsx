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
  Users,
  Baby,
  DollarSign,
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
} from '@/components/ui/select'; // OK: used for housekeeping enum + floor filter
import { EntitySelect, type EntityOption } from '@/components/shared/entity-select';
import { PageHeader } from '@/components/shared/page-header';
import { Fab } from '@/components/layout/fab';
import { RoomTypeWizard } from '@/components/hotel/room-type-wizard';
import { RoomNumberInput } from '@/components/hotel/room-number-input';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/use-profile';
import { useAllRooms, useRoomTypes, useRoomStatuses } from '@/hooks/use-hotel';
import { formatCurrency } from '@/lib/format';
import {
  getSupabaseErrorMessage,
  logSupabaseError,
} from '@/lib/supabase/errors';
import type { Tables } from '@/types/database';
import type { ParsedRoom } from '@/lib/room-number-parser';

// -------------------------------------------------------
// Room edit schema
// -------------------------------------------------------

const roomSchema = z.object({
  number: z.string().min(1, 'El número es requerido'),
  floor: z.string().min(1, 'El piso es requerido'),
  room_type_id: z.string().min(1, 'El tipo es requerido'),
  status_id: z.string().min(1, 'El estado es requerido'),
  housekeeping_status: z.enum(['clean', 'dirty', 'inspected', 'cleaning']),
  notes: z.string().optional(),
});

type RoomFormValues = z.infer<typeof roomSchema>;

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

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tables<'rooms'> | null>(null);
  const [addRoomsTypeId, setAddRoomsTypeId] = useState<string | null>(null);

  // Default status
  const defaultStatusId = useMemo(
    () => roomStatuses.find((s) => s.counts_as_available)?.id ?? roomStatuses[0]?.id ?? '',
    [roomStatuses],
  );

  // Group rooms by type
  const roomsByType = useMemo(() => {
    const groups = new Map<string, Tables<'rooms'>[]>();
    for (const room of rooms) {
      const list = groups.get(room.room_type_id) ?? [];
      list.push(room);
      groups.set(room.room_type_id, list);
    }
    return groups;
  }, [rooms]);

  // EntitySelect options
  const roomTypeOptions = useMemo((): EntityOption[] =>
    roomTypes.map((t) => ({ value: t.id, label: `${t.name} — ${formatCurrency(t.base_rate, currency, locale)}` })),
    [roomTypes, currency, locale],
  );
  const roomStatusOptions = useMemo((): EntityOption[] =>
    roomStatuses.map((s) => ({ value: s.id, label: s.name, color: s.color })),
    [roomStatuses],
  );

  // -------------------------------------------------------
  // Edit room form
  // -------------------------------------------------------
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: { number: '', floor: '', room_type_id: '', status_id: '', housekeeping_status: 'clean', notes: '' },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: RoomFormValues) => {
      const supabase = createClient();
      if (!editTarget) return;
      const { error } = await supabase.from('rooms').update({
        number: values.number,
        floor: values.floor,
        room_type_id: values.room_type_id,
        status_id: values.status_id,
        housekeeping_status: values.housekeeping_status,
        notes: values.notes || null,
      }).eq('id', editTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Habitación actualizada');
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_all_rooms'] });
      setEditDialogOpen(false);
      setEditTarget(null);
    },
    onError: (error) => {
      logSupabaseError(error, 'rooms:save');
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  function openEdit(room: Tables<'rooms'>) {
    setEditTarget(room);
    reset({
      number: room.number,
      floor: room.floor ?? '',
      room_type_id: room.room_type_id,
      status_id: room.status_id,
      housekeeping_status: room.housekeeping_status as 'clean' | 'dirty' | 'inspected' | 'cleaning',
      notes: room.notes ?? '',
    });
    setEditDialogOpen(true);
  }

  // -------------------------------------------------------
  // Add rooms to existing type
  // -------------------------------------------------------
  const [addRoomInput, setAddRoomInput] = useState('');
  const [addParsedRooms, setAddParsedRooms] = useState<ParsedRoom[]>([]);
  const existingNumbers = useMemo(() => new Set(rooms.map((r) => r.number)), [rooms]);

  const addRoomsMutation = useMutation({
    mutationFn: async () => {
      if (!addRoomsTypeId || addParsedRooms.length === 0) return;
      const supabase = createClient();
      const rows = addParsedRooms.map((r) => ({
        organization_id: organizationId,
        number: r.number,
        floor: r.floor,
        room_type_id: addRoomsTypeId,
        status_id: defaultStatusId,
        housekeeping_status: 'clean' as const,
      }));
      const { error } = await supabase.from('rooms').insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} habitación${(count ?? 0) !== 1 ? 'es' : ''} creada${(count ?? 0) !== 1 ? 's' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_all_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });
      setAddRoomsTypeId(null);
      setAddRoomInput('');
      setAddParsedRooms([]);
    },
    onError: (error) => {
      logSupabaseError(error, 'rooms:addBulk');
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  // -------------------------------------------------------
  // Housekeeping labels
  // -------------------------------------------------------
  const hkLabels: Record<string, { label: string; color: string }> = {
    clean: { label: 'Limpia', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    dirty: { label: 'Sucia', color: 'bg-red-500/15 text-red-700 dark:text-red-400' },
    inspected: { label: 'Inspeccionada', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
    cleaning: { label: 'En limpieza', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  };

  const getStatus = (id: string) => roomStatuses.find((s) => s.id === id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Habitaciones"
        description={`${rooms.length} habitación${rooms.length !== 1 ? 'es' : ''} · ${roomTypes.length} tipo${roomTypes.length !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Agregar tipo de habitación
          </Button>
        }
      />

      {/* Content */}
      {roomsLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : roomTypes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
          <BedDouble className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">Aún no hay tipos de habitación</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Crea tu primer tipo de habitación con sus números y tarifa en un solo paso.
          </p>
          <Button className="mt-4" onClick={() => setWizardOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Agregar tipo de habitación
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {roomTypes.map((type) => {
            const typeRooms = roomsByType.get(type.id) ?? [];
            const available = typeRooms.filter((r) => {
              const st = getStatus(r.status_id);
              return r.is_active && st?.counts_as_available;
            }).length;
            const occupied = typeRooms.filter((r) => {
              const st = getStatus(r.status_id);
              return r.is_active && !st?.counts_as_available && !st?.counts_as_out_of_order;
            }).length;

            return (
              <div key={type.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                {/* Type header */}
                <div className="flex items-start gap-4 p-4 sm:p-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BedDouble className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{type.name}</h3>
                      {type.code && (
                        <Badge variant="outline" className="text-[10px] font-mono">{type.code}</Badge>
                      )}
                    </div>
                    {type.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{type.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {type.max_adults}
                      </span>
                      {type.max_children > 0 && (
                        <span className="flex items-center gap-1">
                          <Baby className="h-3.5 w-3.5" /> {type.max_children}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" /> {formatCurrency(type.base_rate, currency, locale)}
                      </span>
                    </div>
                    <p className="text-xs mt-1.5">
                      <span className="font-medium">{typeRooms.length}</span> habitación{typeRooms.length !== 1 ? 'es' : ''}
                      {typeRooms.length > 0 && (
                        <>
                          {' · '}
                          <span className="text-emerald-600 dark:text-emerald-400">{available} disponible{available !== 1 ? 's' : ''}</span>
                          {occupied > 0 && <> · <span className="text-muted-foreground">{occupied} ocupada{occupied !== 1 ? 's' : ''}</span></>}
                        </>
                      )}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => setAddRoomsTypeId(type.id)}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
                  </Button>
                </div>

                {/* Room chips */}
                {typeRooms.length > 0 && (
                  <div className="border-t px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap gap-1.5">
                      {typeRooms
                        .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                        .map((room) => {
                          const status = getStatus(room.status_id);
                          const hk = hkLabels[room.housekeeping_status] ?? hkLabels.clean;
                          return (
                            <button
                              key={room.id}
                              onClick={() => openEdit(room)}
                              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/50 ${!room.is_active ? 'opacity-40' : ''}`}
                            >
                              {status?.color && (
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
                              )}
                              <span className="font-bold">{room.number}</span>
                              <span className="text-[10px] text-muted-foreground">P{room.floor ?? '?'}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Amenities */}
                {type.amenities && type.amenities.length > 0 && (
                  <div className="border-t px-4 py-2 sm:px-5">
                    <div className="flex flex-wrap gap-1">
                      {type.amenities.map((a) => (
                        <Badge key={a} variant="secondary" className="text-[9px] font-normal">{a}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Wizard */}
      <RoomTypeWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* FAB */}
      <Fab icon={Plus} onClick={() => setWizardOpen(true)} label="Agregar tipo" />

      {/* Add rooms dialog */}
      <Dialog open={!!addRoomsTypeId} onOpenChange={(v) => { if (!v) { setAddRoomsTypeId(null); setAddRoomInput(''); setAddParsedRooms([]); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Agregar habitaciones a {roomTypes.find((t) => t.id === addRoomsTypeId)?.name ?? ''}
            </DialogTitle>
          </DialogHeader>
          <RoomNumberInput
            value={addRoomInput}
            onChange={setAddRoomInput}
            existingNumbers={existingNumbers}
            parsedRooms={addParsedRooms}
            onParsedChange={setAddParsedRooms}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddRoomsTypeId(null)}>Cancelar</Button>
            <Button
              disabled={addParsedRooms.length === 0 || addRoomsMutation.isPending}
              onClick={() => addRoomsMutation.mutate()}
            >
              {addRoomsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Crear ${addParsedRooms.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit room dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar habitación {editTarget?.number}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Número *</Label>
                <Input {...register('number')} />
                {errors.number && <p className="text-xs text-destructive">{errors.number.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Piso *</Label>
                <Input {...register('floor')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <EntitySelect options={roomTypeOptions} value={watch('room_type_id') || null} onChange={(v) => setValue('room_type_id', v ?? '')} placeholder="Seleccionar tipo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <EntitySelect options={roomStatusOptions} value={watch('status_id') || null} onChange={(v) => setValue('status_id', v ?? '')} />
              </div>
              <div className="space-y-1.5">
                <Label>Limpieza</Label>
                <Select value={watch('housekeeping_status')} onValueChange={(v) => setValue('housekeeping_status', v as 'clean' | 'dirty' | 'inspected' | 'cleaning')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clean">Limpia</SelectItem>
                    <SelectItem value="dirty">Sucia</SelectItem>
                    <SelectItem value="inspected">Inspeccionada</SelectItem>
                    <SelectItem value="cleaning">En limpieza</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea rows={2} {...register('notes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting || saveMutation.isPending}>
                {(isSubmitting || saveMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
