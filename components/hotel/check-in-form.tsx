'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: rooms = [] } = useRooms();
  const { data: guests = [] } = useGuests(guestSearch);
  const { data: documentTypes = [] } = useDocumentTypes();
  const { data: channels = [] } = useBookingChannels();
  const { data: travelReasons = [] } = useTravelReasons();

  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');

  const availableRooms = rooms.filter(
    (r) => r.room_status.counts_as_available && !r.current_stay,
  );

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

  // When room changes, suggest rate from room type
  const handleRoomChange = useCallback(
    (roomId: string | null) => {
      if (!roomId) return;
      setValue('roomId', roomId);
      const room = rooms.find((r) => r.id === roomId);
      if (room) {
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
    setServerError(null);

    const action = mode === 'checkin' ? checkInAction : createReservationAction;
    const result = await action(data);

    setIsSubmitting(false);

    if ('error' in result && result.error) {
      setServerError(result.error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_reservations'] });
      reset();
      setSelectedGuest(null);
      onOpenChange(false);
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input {...register('guestData.firstName')} placeholder="Nombre" />
              {errors.guestData?.firstName && (
                <p className="mt-0.5 text-xs text-red-500">{errors.guestData.firstName.message}</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Apellido *</Label>
              <Input {...register('guestData.lastName')} placeholder="Apellido" />
              {errors.guestData?.lastName && (
                <p className="mt-0.5 text-xs text-red-500">{errors.guestData.lastName.message}</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Tipo de documento</Label>
              <Select
                value={watch('guestData.documentTypeId') ?? ''}
                onValueChange={(v) =>
                  setValue('guestData.documentTypeId', v || undefined)
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin especificar</SelectItem>
                  {documentTypes.map((dt) => (
                    <SelectItem key={dt.id} value={dt.id}>
                      {dt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Número de documento</Label>
              <Input {...register('guestData.documentNumber')} placeholder="123456789" />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input {...register('guestData.phone')} placeholder="+57 300 000 0000" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input {...register('guestData.email')} type="email" placeholder="correo@ejemplo.com" />
              {errors.guestData?.email && (
                <p className="mt-0.5 text-xs text-red-500">{errors.guestData.email.message}</p>
              )}
            </div>
          </div>

          {/* ============================= */}
          {/* Stay details */}
          {/* ============================= */}
          <div className="border-t pt-4 space-y-3">
            <Label className="text-sm font-semibold">Datos de la estancia</Label>

            <div className="grid grid-cols-2 gap-3">
              {/* Room */}
              <div className="col-span-2">
                <Label className="text-xs">Habitación *</Label>
                <Select value={watchRoomId} onValueChange={handleRoomChange}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Seleccionar habitación..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        Hab. {r.number} — {r.room_type.name} (
                        {copFormatter.format(r.room_type.base_rate)}/noche)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.roomId && (
                  <p className="mt-0.5 text-xs text-red-500">{errors.roomId.message}</p>
                )}
              </div>

              {/* Dates */}
              <div>
                <Label className="text-xs">Fecha de entrada *</Label>
                <Input type="date" {...register('checkInDate')} />
                {errors.checkInDate && (
                  <p className="mt-0.5 text-xs text-red-500">{errors.checkInDate.message}</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Fecha de salida *</Label>
                <Input type="date" {...register('checkOutDate')} />
                {errors.checkOutDate && (
                  <p className="mt-0.5 text-xs text-red-500">{errors.checkOutDate.message}</p>
                )}
              </div>

              {/* Rate */}
              <div>
                <Label className="text-xs">Tarifa por noche *</Label>
                <Input
                  type="number"
                  step="1000"
                  {...register('ratePerNight', { valueAsNumber: true })}
                  placeholder="150000"
                />
                {errors.ratePerNight && (
                  <p className="mt-0.5 text-xs text-red-500">{errors.ratePerNight.message}</p>
                )}
              </div>

              {/* Adults / children */}
              <div className="grid grid-cols-2 gap-2">
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
              <div>
                <Label className="text-xs">Canal de reserva</Label>
                <Select
                  value={watch('channelId') ?? ''}
                  onValueChange={(v) => setValue('channelId', v || undefined)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin especificar</SelectItem>
                    {channels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Travel reason */}
              <div>
                <Label className="text-xs">Motivo de viaje</Label>
                <Select
                  value={watch('travelReasonId') ?? ''}
                  onValueChange={(v) => setValue('travelReasonId', v || undefined)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin especificar</SelectItem>
                    {travelReasons.map((tr) => (
                      <SelectItem key={tr.id} value={tr.id}>
                        {tr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs">Notas</Label>
              <Input {...register('notes')} placeholder="Observaciones opcionales..." />
            </div>
          </div>

          {/* Error */}
          {serverError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
          )}

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
