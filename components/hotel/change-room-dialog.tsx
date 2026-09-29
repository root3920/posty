'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, BedDouble } from 'lucide-react';
import { toast } from 'sonner';

import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { EntitySelect } from '@/components/shared/entity-select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

import { createClient } from '@/lib/supabase/client';
import { getSupabaseErrorMessage } from '@/lib/supabase/errors';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface StayForRoomChange {
  id: string;
  check_in_date: string;
  check_out_date: string;
  room_id: string;
  room_type_id: string;
  room_number: string;
  room_type_name: string;
}

interface AvailableRoom {
  id: string;
  number: string;
  floor: number | null;
}

// -------------------------------------------------------
// Fetch
// -------------------------------------------------------

async function fetchStayForRoomChange(stayId: string): Promise<StayForRoomChange | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stays')
    .select(
      `
      id,
      check_in_date,
      check_out_date,
      room_id,
      room:rooms(
        id,
        number,
        floor,
        room_type_id,
        room_type:room_types(id, name)
      )
      `,
    )
    .eq('id', stayId)
    .single();
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = data as any;
  return {
    id: raw.id,
    check_in_date: raw.check_in_date,
    check_out_date: raw.check_out_date,
    room_id: raw.room.id,
    room_type_id: raw.room.room_type_id,
    room_number: raw.room.number,
    room_type_name: raw.room.room_type?.name ?? '',
  };
}

async function fetchAvailableRoomsForPeriod(
  roomTypeId: string,
  startDate: string,
  endDate: string,
): Promise<AvailableRoom[]> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    'available_rooms_of_type_for_period',
    {
      p_room_type_id: roomTypeId,
      p_start_date: startDate,
      p_end_date: endDate,
    },
  );
  if (error) {
    console.error('available_rooms_of_type_for_period error:', error);
    return [];
  }
  return (data ?? []) as AvailableRoom[];
}

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface ChangeRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stayId: string | null;
  onSaved?: () => void;
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function ChangeRoomDialog({
  open,
  onOpenChange,
  stayId,
  onSaved,
}: ChangeRoomDialogProps) {
  const queryClient = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: stay, isLoading: loadingStay } = useQuery({
    queryKey: ['stay_for_room_change', stayId],
    queryFn: () => fetchStayForRoomChange(stayId!),
    enabled: !!stayId && open,
    staleTime: 15 * 1000,
  });

  const { data: availableRooms = [], isLoading: loadingRooms } = useQuery({
    queryKey: [
      'available_rooms_for_period',
      stay?.room_type_id,
      stay?.check_in_date,
      stay?.check_out_date,
    ],
    queryFn: () =>
      fetchAvailableRoomsForPeriod(
        stay!.room_type_id,
        stay!.check_in_date,
        stay!.check_out_date,
      ),
    enabled: !!stay?.room_type_id && !!stay?.check_in_date && !!stay?.check_out_date && open,
    staleTime: 15 * 1000,
  });

  // Exclude the current room from options
  const roomOptions = availableRooms
    .filter((r) => r.id !== stay?.room_id)
    .map((r) => ({
      value: r.id,
      label: `Hab. ${r.number}${r.floor != null ? ` · Piso ${r.floor}` : ''}`,
    }));

  function handleOpenChange(v: boolean) {
    if (!v) setSelectedRoomId(null);
    onOpenChange(v);
  }

  async function handleSubmit() {
    if (!stayId || !selectedRoomId) {
      toast.error('Selecciona una habitación de destino');
      return;
    }
    setIsSubmitting(true);
    const supabase = createClient();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('change_stay_room', {
        p_stay_id: stayId,
        p_new_room_id: selectedRoomId,
      });
      if (error) throw error;

      toast.success('Habitación cambiada correctamente');

      queryClient.invalidateQueries({ queryKey: ['stays_view'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });

      handleOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(getSupabaseErrorMessage(err, 'Error al cambiar la habitación'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
        Cancelar
      </Button>
      <Button onClick={handleSubmit} disabled={isSubmitting || !selectedRoomId || loadingStay}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cambiando...
          </>
        ) : (
          'Confirmar cambio'
        )}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Cambiar habitación"
      description="Asigna una habitación diferente para este período"
      footer={footer}
    >
      {loadingStay || !stay ? (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Current room info */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <BedDouble className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Habitación actual</p>
              <p className="text-sm font-semibold">
                Hab. {stay.room_number}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  · {stay.room_type_name}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {stay.check_in_date} → {stay.check_out_date}
              </p>
            </div>
          </div>

          {/* New room selector */}
          <div className="space-y-1.5">
            <Label>Nueva habitación</Label>
            {loadingRooms ? (
              <Skeleton className="h-9 rounded-lg" />
            ) : roomOptions.length === 0 ? (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                No hay habitaciones disponibles del mismo tipo para este período.
              </p>
            ) : (
              <EntitySelect
                options={roomOptions}
                value={selectedRoomId}
                onChange={setSelectedRoomId}
                placeholder="Seleccionar habitación..."
              />
            )}
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}
