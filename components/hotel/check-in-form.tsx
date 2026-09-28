'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { format, differenceInCalendarDays } from 'date-fns';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { EntitySelect, type EntityOption } from '@/components/shared/entity-select';
import { PhoneInput } from '@/components/shared/phone-input';
import { useDefaultCountry } from '@/components/providers/geo-provider';
import type { Country } from 'react-phone-number-input';

import { checkInSchema, type CheckInInput } from '@/lib/validations/hotel';
import { checkInAction, createReservationAction } from '@/app/actions/hotel';
import {
  useRooms,
  useGuests,
  useDocumentTypes,
  useBookingChannels,
  useTravelReasons,
  useAvailableRoomsByType,
  type RoomTypeAvailability,
} from '@/hooks/use-hotel';
import { usePermissions } from '@/hooks/use-permissions';
import { useProfile } from '@/hooks/use-profile';
import { formatCurrency } from '@/lib/format';
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
// Component
// -------------------------------------------------------

export function CheckInForm({ open, onOpenChange, mode = 'checkin', defaultRoomId }: CheckInFormProps) {
  const queryClient = useQueryClient();
  const orgDefaultCountry = useDefaultCountry();
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Tables<'guests'> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState<Country>(orgDefaultCountry as Country);
  const [showSpecificRoom, setShowSpecificRoom] = useState(false);

  const { data: profile } = useProfile();
  const currency = profile?.organization?.currency ?? 'COP';
  const locale = profile?.organization?.locale ?? 'es-CO';

  const { data: rooms = [] } = useRooms();
  const { data: guests = [] } = useGuests(guestSearch);
  const { data: documentTypes = [] } = useDocumentTypes();
  const { data: channels = [] } = useBookingChannels();
  const { data: travelReasons = [] } = useTravelReasons();
  const { has: hasPerm } = usePermissions();

  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<CheckInInput>({
    resolver: zodResolver(checkInSchema) as any,
    defaultValues: {
      roomTypeId: '',
      roomId: null,
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

  const watchCheckIn = watch('checkInDate');
  const watchCheckOut = watch('checkOutDate');
  const watchRate = watch('ratePerNight');
  const watchRoomTypeId = watch('roomTypeId');
  const watchAdults = watch('adults');
  const watchChildren = watch('children');

  // Fetch availability by type for selected dates
  const { data: typeAvailability = [], isLoading: availLoading, error: availError } =
    useAvailableRoomsByType(watchCheckIn, watchCheckOut);

  // Calculate nights and total
  const nights = useMemo(() => {
    if (!watchCheckIn || !watchCheckOut) return 0;
    const d = differenceInCalendarDays(new Date(watchCheckOut), new Date(watchCheckIn));
    return d > 0 ? d : 0;
  }, [watchCheckIn, watchCheckOut]);

  const total = nights * (watchRate || 0);

  // Check if selected type is still available when dates/guests change
  useEffect(() => {
    if (!watchRoomTypeId || typeAvailability.length === 0) return;
    const selected = typeAvailability.find((t) => t.id === watchRoomTypeId);
    if (selected && (selected.available_count === 0 || selected.max_adults < watchAdults || selected.max_children < watchChildren)) {
      setValue('roomTypeId', '');
      setValue('roomId', null);
      setShowSpecificRoom(false);
    }
  }, [typeAvailability, watchRoomTypeId, watchAdults, watchChildren, setValue]);

  // Available specific rooms for selected type (when manual selection enabled)
  const specificRooms = useMemo(() => {
    if (!watchRoomTypeId || !showSpecificRoom) return [];
    return rooms.filter((r) => {
      if (r.room_type_id !== watchRoomTypeId) return false;
      if (!r.room_status?.counts_as_available) return false;
      if (!r.is_active) return false;
      if (r.active_stays && r.active_stays.length > 0 && watchCheckIn && watchCheckOut) {
        const hasOverlap = r.active_stays.some((stay) =>
          stay.check_in_date < watchCheckOut && stay.check_out_date > watchCheckIn,
        );
        if (hasOverlap) return false;
      }
      return true;
    });
  }, [rooms, watchRoomTypeId, showSpecificRoom, watchCheckIn, watchCheckOut]);

  // Room type options with availability info
  const roomTypeOptions = useMemo((): EntityOption[] =>
    typeAvailability.map((t) => {
      const status = getTypeStatus(t);
      const availText = status === 'available'
        ? `${t.available_count} disponible${t.available_count !== 1 ? 's' : ''}`
        : status === 'no_availability'
          ? 'Sin disponibilidad'
          : 'Capacidad insuficiente';
      return {
        value: t.id,
        label: `${t.name} · ${formatCurrency(t.base_rate, currency, locale)}`,
        description: availText,
        disabled: status !== 'available',
        disabledReason: status !== 'available' ? availText : undefined,
      };
    }),
    [typeAvailability, currency, locale, watchAdults, watchChildren], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Specific room options (when manual selection enabled)
  const specificRoomOptions = useMemo((): EntityOption[] =>
    specificRooms.map((r) => {
      const hk = r.housekeeping_status === 'clean' ? 'Limpia' : r.housekeeping_status === 'inspected' ? 'Inspeccionada' : '';
      return {
        value: r.id,
        label: `Hab. ${r.number} — Piso ${r.floor}${hk ? ` · ${hk}` : ''}`,
      };
    }),
    [specificRooms],
  );

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

  // When type changes, auto-fill rate
  const handleTypeChange = useCallback(
    (typeId: string | null) => {
      setValue('roomTypeId', typeId ?? '');
      setValue('roomId', null);
      setShowSpecificRoom(false);
      if (!typeId) return;
      const roomType = typeAvailability.find((t) => t.id === typeId);
      if (roomType) {
        setValue('ratePerNight', roomType.base_rate);
      }
    },
    [typeAvailability, setValue],
  );

  function getTypeStatus(t: RoomTypeAvailability): 'available' | 'no_availability' | 'capacity' {
    if (t.available_count === 0) return 'no_availability';
    if (t.max_adults < watchAdults || t.max_children < watchChildren) return 'capacity';
    return 'available';
  }

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
        queryClient.invalidateQueries({ queryKey: ['available_rooms_by_type'] });

        const roomNumber = (result as { roomNumber?: string; tasksGenerated?: number }).roomNumber;
        const tasksGenerated = (result as { roomNumber?: string; tasksGenerated?: number }).tasksGenerated ?? 0;
        const label = mode === 'checkin' ? 'Check-in realizado' : 'Reserva creada';
        let msg = roomNumber ? `${label} · Hab. ${roomNumber}` : label;
        if (tasksGenerated > 0) msg += ` · ${tasksGenerated} tareas generadas`;
        toast.success(msg);
        reset();
        setSelectedGuest(null);
        setShowSpecificRoom(false);
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
  // Count total rooms in org (from useRooms)
  const totalRoomsInOrg = rooms.length;
  // The RPC returned room types — even those with 0 availability
  const hasRoomTypes = typeAvailability.length > 0;
  const hasAnyAvailability = typeAvailability.some((t) => t.available_count > 0);
  const hasNoRoomsAtAll = totalRoomsInOrg === 0 && !availLoading;
  const rpcFailed = !!availError && !availLoading;

  const formFooter = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
        Cancelar
      </Button>
      <Button
        type="submit"
        form="check-in-form"
        disabled={isSubmitting}
      >
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
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={formFooter}
    >
        <form id="check-in-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <Controller
                name="guestData.phone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    value={field.value ?? ''}
                    onChange={(v) => field.onChange(v ?? '')}
                    defaultCountry={phoneCountry}
                    onCountryChange={(c) => setPhoneCountry(c)}
                    error={errors.guestData?.phone?.message}
                  />
                )}
              />
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Dates FIRST — availability depends on them */}
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

              {/* Adults / children — affects capacity validation */}
              <div className="min-w-0 grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Adultos *</Label>
                  <Input type="number" min={1} max={20} {...register('adults', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label className="text-xs">Niños</Label>
                  <Input type="number" min={0} max={20} {...register('children', { valueAsNumber: true })} />
                </div>
              </div>

              {/* Room type selection */}
              <div className="col-span-2 min-w-0 space-y-1.5">
                <Label className="text-xs">Tipo de habitación *</Label>
                {rpcFailed ? (
                  <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="flex-1">No se pudo consultar la disponibilidad: {String(availError)}</span>
                  </div>
                ) : hasNoRoomsAtAll ? (
                  <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning dark:border-warning/30 dark:bg-warning/15">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="flex-1">Aún no has creado habitaciones.</span>
                    <Link href="/configuracion/catalogos" className="shrink-0 text-xs font-medium underline">
                      Crear habitaciones
                    </Link>
                  </div>
                ) : !hasRoomTypes && !availLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-info/20 bg-info/10 px-3 py-2 text-sm text-info">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="flex-1">No hay disponibilidad para estas fechas.</span>
                  </div>
                ) : (
                  <>
                    <EntitySelect
                      options={roomTypeOptions}
                      value={watchRoomTypeId || null}
                      onChange={handleTypeChange}
                      placeholder="Seleccionar tipo"
                      loadingPlaceholder="Cargando disponibilidad…"
                      isLoading={availLoading}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Se asignará automáticamente una habitación disponible de este tipo.
                    </p>
                  </>
                )}
                {errors.roomTypeId && (
                  <p className="mt-0.5 text-xs text-danger">{errors.roomTypeId.message}</p>
                )}
              </div>

              {/* Optional: specific room selection for privileged users */}
              {watchRoomTypeId && hasPerm('stays.edit') && (
                <div className="col-span-2 min-w-0">
                  {!showSpecificRoom ? (
                    <button
                      type="button"
                      onClick={() => setShowSpecificRoom(true)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Elegir habitación específica
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Habitación específica</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowSpecificRoom(false);
                            setValue('roomId', null);
                          }}
                          className="text-[11px] text-muted-foreground hover:text-foreground underline"
                        >
                          Asignación automática
                        </button>
                      </div>
                      <EntitySelect
                        options={specificRoomOptions}
                        value={watch('roomId') ?? null}
                        onChange={(v) => setValue('roomId', v)}
                        placeholder="Automática (recomendado)"
                        emptyMessage="No hay habitaciones disponibles de este tipo"
                      />
                    </div>
                  )}
                </div>
              )}

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
                    {nights} noche{nights !== 1 ? 's' : ''} × {formatCurrency(watchRate, currency, locale)} ={' '}
                    <span className="font-semibold text-foreground">{formatCurrency(total, currency, locale)}</span>
                  </p>
                )}
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
        </form>
    </ResponsiveDialog>
  );
}
