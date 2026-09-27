'use client';

import { useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { format, differenceInCalendarDays } from 'date-fns';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EntitySelect, type EntityOption } from '@/components/shared/entity-select';

import { checkInSchema, type CheckInInput } from '@/lib/validations/hotel';
import { checkInAction, createReservationAction } from '@/app/actions/hotel';
import {
  useRooms,
  useGuests,
  useDocumentTypes,
  useBookingChannels,
  useTravelReasons,
} from '@/hooks/use-hotel';
import type { Tables } from '@/types/database';

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface CheckInFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'checkin' | 'reservation';
  defaultRoomId?: string;
}

// -------------------------------------------------------
// Currency formatter
// -------------------------------------------------------

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function CheckInForm({ open, onOpenChange, mode = 'checkin', defaultRoomId }: CheckInFormProps) {
  const queryClient = useQueryClient();
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Tables<'guests'> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: rooms = [] } = useRooms();
  const { data: guests = [] } = useGuests(guestSearch);
  const { data: documentTypes = [] } = useDocumentTypes();
  const { data: channels = [] } = useBookingChannels();
  const { data: travelReasons = [] } = useTravelReasons();

  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<CheckInInput>({
    resolver: zodResolver(checkInSchema) as any,
    defaultValues: {
      roomId: defaultRoomId ?? '',
      checkInDate: today,
      checkOutDate: tomorrow,
      adults: 1,
      children: 0,
      ratePerNight: 0,
      guestData: {
        firstName: '',
        lastName: '',
      },
    },
  });

  const watchRoomId = watch('roomId');
  const watchCheckIn = watch('checkInDate');
  const watchCheckOut = watch('checkOutDate');
  const watchRate = watch('ratePerNight');

  // Calculate nights and total
  const nights = useMemo(() => {
    if (!watchCheckIn || !watchCheckOut) return 0;
    const d = differenceInCalendarDays(new Date(watchCheckOut), new Date(watchCheckIn));
    return d > 0 ? d : 0;
  }, [watchCheckIn, watchCheckOut]);

  const total = nights * (watchRate || 0);

  // Available rooms: active, counts_as_available, no overlapping reserved/checked_in stay
  const availableRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (!r.room_status?.counts_as_available) return false;
      if (!r.is_active) return false;
      // Check for date overlap with any active stays
      if (r.active_stays && r.active_stays.length > 0 && watchCheckIn && watchCheckOut) {
        const hasOverlap = r.active_stays.some((stay) => {
          // [checkIn, checkOut) overlaps with [stay.check_in_date, stay.check_out_date)
          return stay.check_in_date < watchCheckOut && stay.check_out_date > watchCheckIn;
        });
        if (hasOverlap) return false;
      } else if (r.current_stay) {
        return false;
      }
      return true;
    });
  }, [rooms, watchCheckIn, watchCheckOut]);

  // Determine why no rooms are available for better messaging
  const noRoomsReason = useMemo(() => {
    if (rooms.length === 0) return 'no_rooms' as const;
    // All rooms occupied/unavailable for these dates
    return 'all_occupied' as const;
  }, [rooms]);

  // Options for EntitySelect
  const roomOptions = useMemo((): EntityOption[] => {
    return availableRooms.map((r) => ({
      value: r.id,
      label: `${r.number} · ${r.room_type?.name ?? ''} · ${copFormatter.format(r.room_type?.base_rate ?? 0)}`,
    }));
  }, [availableRooms]);

  const documentTypeOptions = useMemo((): EntityOption[] =>
    documentTypes.map((dt) => ({ value: dt.id, label: `${dt.code} — ${dt.name}` })),
    [documentTypes],
  );

  const channelOptions = useMemo((): EntityOption[] =>
    channels.map((c) => ({ value: c.id, label: c.name })),
    [channels],
  );

  const travelReasonOptions = useMemo((): EntityOption[] =>
    travelReasons.map((tr) => ({ value: tr.id, label: tr.name })),
    [travelReasons],
  );

  // When room changes, auto-fill rate from room type
  const handleRoomChange = useCallback(
    (roomId: string | null) => {
      setValue('roomId', roomId ?? '');
      if (!roomId) return;
      const room = rooms.find((r) => r.id === roomId);
      if (room?.room_type?.base_rate) {
        setValue('ratePerNight', room.room_type.base_rate);
      }
    },
    [rooms, setValue],
  );

  // Fill form from selected guest
  function selectGuest(guest: Tables<'guests'>) {
    setSelectedGuest(guest);
    setValue('guestData.firstName', guest.first_name);
    setValue('guestData.lastName', guest.last_name);
    setValue('guestData.documentTypeId', guest.document_type_id ?? undefined);
    setValue('guestData.documentNumber', guest.document_number ?? undefined);
    setValue('guestData.nationality', guest.nationality ?? undefined);
    setValue('guestData.birthDate', guest.birth_date ?? undefined);
    setValue('guestData.phone', guest.phone ?? undefined);
    setValue('guestData.email', guest.email ?? undefined);
    setGuestSearch('');
  }

  function clearGuest() {
    setSelectedGuest(null);
    setValue('guestData.firstName', '');
    setValue('guestData.lastName', '');
    setValue('guestData.documentTypeId', undefined);
    setValue('guestData.documentNumber', undefined);
    setValue('guestData.phone', undefined);
    setValue('guestData.email', undefined);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (data: any) => {
    setIsSubmitting(true);

    try {
      const action = mode === 'checkin' ? checkInAction : createReservationAction;
      const result = await action(data);

      if ('error' in result && result.error) {
        console.error('Check-in server error:', result.error);
        toast.error(result.error);
      } else {
        queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
        queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });
        queryClient.invalidateQueries({ queryKey: ['hotel_reservations'] });
        toast.success(mode === 'checkin' ? 'Check-in exitoso' : 'Reserva creada');
        reset();
        setSelectedGuest(null);
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Check-in unexpected error:', err);
      toast.error('Error inesperado al procesar la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = mode === 'checkin' ? 'Registrar Check-In' : 'Nueva Reserva';
  const submitLabel = mode === 'checkin' ? 'Hacer Check-In' : 'Crear Reserva';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* ============================= */}
          {/* Guest search */}
          {/* ============================= */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Huésped principal</Label>

            {!selectedGuest ? (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o documento..."
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>

                {guestSearch.length >= 2 && guests.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-md border bg-background shadow-sm">
                    {guests.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => selectGuest(g)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="font-medium">
                          {g.last_name}, {g.first_name}
                        </span>
                        {g.document_number && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {g.document_number}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {guestSearch.length >= 2 && guests.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No se encontró el huésped. Complete los datos manualmente.
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/40">
                <div>
                  <p className="font-medium text-sm">
                    {selectedGuest.last_name}, {selectedGuest.first_name}
                  </p>
                  {selectedGuest.document_number && (
                    <p className="text-xs text-muted-foreground">{selectedGuest.document_number}</p>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={clearGuest}>
                  Cambiar
                </Button>
              </div>
            )}
          </div>

          {/* Guest data fields */}
          <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
            <div className="min-w-0">
              <Label className="text-xs">Nombre *</Label>
              <Input {...register('guestData.firstName')} placeholder="Nombre" />
              {errors.guestData?.firstName && (
                <p className="mt-0.5 text-xs text-danger">{errors.guestData.firstName.message}</p>
              )}
            </div>
            <div className="min-w-0">
              <Label className="text-xs">Apellido *</Label>
              <Input {...register('guestData.lastName')} placeholder="Apellido" />
              {errors.guestData?.lastName && (
                <p className="mt-0.5 text-xs text-danger">{errors.guestData.lastName.message}</p>
              )}
            </div>
            <div className="min-w-0">
              <Label className="text-xs">Tipo de documento</Label>
              <EntitySelect
                options={documentTypeOptions}
                value={watch('guestData.documentTypeId') ?? null}
                onChange={(v) => setValue('guestData.documentTypeId', v ?? undefined)}
                placeholder="Seleccionar..."
                allowClear
                clearLabel="Sin especificar"
              />
            </div>
            <div className="min-w-0">
              <Label className="text-xs">Número de documento</Label>
              <Input {...register('guestData.documentNumber')} placeholder="123456789" />
            </div>
            <div className="min-w-0">
              <Label className="text-xs">Teléfono</Label>
              <Input {...register('guestData.phone')} placeholder="+57 300 000 0000" />
            </div>
            <div className="min-w-0">
              <Label className="text-xs">Email</Label>
              <Input {...register('guestData.email')} type="email" placeholder="correo@ejemplo.com" />
              {errors.guestData?.email && (
                <p className="mt-0.5 text-xs text-danger">{errors.guestData.email.message}</p>
              )}
            </div>
          </div>

          {/* ============================= */}
          {/* Stay details */}
          {/* ============================= */}
          <div className="border-t pt-4 space-y-3">
            <Label className="text-sm font-semibold">Datos de la estancia</Label>

            <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
              {/* Room */}
              <div className="col-span-2 min-w-0">
                <Label className="text-xs">Habitación *</Label>
                {roomOptions.length > 0 ? (
                  <EntitySelect
                    options={roomOptions}
                    value={watchRoomId || null}
                    onChange={handleRoomChange}
                    placeholder="Seleccionar habitación..."
                  />
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning dark:border-warning/30 dark:bg-warning/15 dark:text-warning">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="flex-1">
                      {noRoomsReason === 'no_rooms'
                        ? 'Aún no has creado habitaciones.'
                        : 'Todas las habitaciones están ocupadas o no disponibles en estas fechas.'}
                    </span>
                    <Link
                      href="/hotel/habitaciones"
                      className="shrink-0 text-xs font-medium underline"
                    >
                      {noRoomsReason === 'no_rooms' ? 'Crear habitaciones' : 'Ver habitaciones'}
                    </Link>
                  </div>
                )}
                {errors.roomId && (
                  <p className="mt-0.5 text-xs text-danger">{errors.roomId.message}</p>
                )}
              </div>

              {/* Dates */}
              <div className="min-w-0">
                <Label className="text-xs">Fecha de entrada *</Label>
                <Input type="date" {...register('checkInDate')} />
                {errors.checkInDate && (
                  <p className="mt-0.5 text-xs text-danger">{errors.checkInDate.message}</p>
                )}
              </div>
              <div className="min-w-0">
                <Label className="text-xs">Fecha de salida *</Label>
                <Input type="date" {...register('checkOutDate')} />
                {errors.checkOutDate && (
                  <p className="mt-0.5 text-xs text-danger">{errors.checkOutDate.message}</p>
                )}
              </div>

              {/* Rate + total */}
              <div className="min-w-0">
                <Label className="text-xs">Tarifa por noche *</Label>
                <Input
                  type="number"
                  step="1000"
                  {...register('ratePerNight', { valueAsNumber: true })}
                  placeholder="150000"
                />
                {errors.ratePerNight && (
                  <p className="mt-0.5 text-xs text-danger">{errors.ratePerNight.message}</p>
                )}
                {nights > 0 && watchRate > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nights} noche{nights !== 1 ? 's' : ''} × {copFormatter.format(watchRate)} ={' '}
                    <span className="font-semibold text-foreground">{copFormatter.format(total)}</span>
                  </p>
                )}
              </div>

              {/* Adults / children */}
              <div className="min-w-0 grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Adultos *</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    {...register('adults', { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Niños</Label>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    {...register('children', { valueAsNumber: true })}
                  />
                </div>
              </div>

              {/* Channel */}
              <div className="min-w-0">
                <Label className="text-xs">Canal de reserva</Label>
                <EntitySelect
                  options={channelOptions}
                  value={watch('channelId') ?? null}
                  onChange={(v) => setValue('channelId', v ?? undefined)}
                  placeholder="Seleccionar..."
                  allowClear
                  clearLabel="Sin especificar"
                />
              </div>

              {/* Travel reason */}
              <div className="min-w-0">
                <Label className="text-xs">Motivo de viaje</Label>
                <EntitySelect
                  options={travelReasonOptions}
                  value={watch('travelReasonId') ?? null}
                  onChange={(v) => setValue('travelReasonId', v ?? undefined)}
                  placeholder="Seleccionar..."
                  allowClear
                  clearLabel="Sin especificar"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs">Notas</Label>
              <Input {...register('notes')} placeholder="Observaciones opcionales..." />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
