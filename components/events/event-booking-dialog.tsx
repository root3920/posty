'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { EntitySelect, type EntityOption } from '@/components/shared/entity-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import { formatCurrency } from '@/lib/format';
import { useProfile } from '@/hooks/use-profile';
import { usePaymentMethods } from '@/hooks/use-hotel';
import {
  useEventVenues,
  useVenueBookingsForDate,
  useCreateEventBooking,
} from '@/hooks/use-events';
import { PRICING_TYPE_LABELS } from './event-status-badge';

// -------------------------------------------------------
// Schema
// -------------------------------------------------------

const bookingSchema = z.object({
  venue_id: z.string().min(1, 'Selecciona un espacio'),
  event_date: z.string().min(1, 'La fecha es obligatoria'),
  start_time: z.string().min(1, 'La hora de inicio es obligatoria'),
  end_time: z.string().min(1, 'La hora de fin es obligatoria'),
  guest_count: z.coerce.number().int().min(1, 'Indica el número de personas'),
  client_name: z.string().min(1, 'El nombre del cliente es obligatorio'),
  client_document: z.string().optional(),
  client_phone: z.string().min(1, 'El teléfono es obligatorio'),
  client_email: z.string().email('Email inválido').optional().or(z.literal('')),
  is_hotel_guest: z.boolean().default(false),
  room_number: z.string().optional(),
  deposit_received: z.coerce.number().min(0).default(0),
  deposit_method_id: z.string().optional(),
  rental_paid: z.boolean().default(false),
  notes: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface EventBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedVenueId?: string;
  onSaved?: () => void;
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function hoursFromTimes(start: string, end: string): number {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  return diff > 0 ? diff / 60 : 0;
}

function timesConflict(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);
  return aS < bE && aE > bS;
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function EventBookingDialog({
  open,
  onOpenChange,
  preselectedVenueId,
  onSaved,
}: EventBookingDialogProps) {
  const { data: profile } = useProfile();
  const currency = profile?.organization?.currency ?? 'COP';
  const locale = profile?.organization?.locale ?? 'es-CO';

  const { data: venues = [], isLoading: venuesLoading } = useEventVenues();
  const { data: paymentMethods = [], isLoading: methodsLoading } = usePaymentMethods();
  const createBooking = useCreateEventBooking();

  const today = format(new Date(), 'yyyy-MM-dd');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BookingFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(bookingSchema) as any,
    defaultValues: {
      venue_id: preselectedVenueId ?? '',
      event_date: '',
      start_time: '',
      end_time: '',
      guest_count: 1,
      client_name: '',
      client_document: '',
      client_phone: '',
      client_email: '',
      is_hotel_guest: false,
      room_number: '',
      deposit_received: 0,
      deposit_method_id: '',
      rental_paid: false,
      notes: '',
    },
  });

  const venueId = watch('venue_id');
  const eventDate = watch('event_date');
  const startTime = watch('start_time');
  const endTime = watch('end_time');
  const guestCount = watch('guest_count');
  const depositReceived = watch('deposit_received');
  const rentalPaid = watch('rental_paid');
  const isHotelGuest = watch('is_hotel_guest');

  // Selected venue details
  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === venueId) ?? null,
    [venues, venueId],
  );

  // Existing bookings for the selected venue + date
  const { data: existingBookings = [] } = useVenueBookingsForDate(
    venueId || undefined,
    eventDate || undefined,
  );

  // Pre-fill when preselectedVenueId changes
  useEffect(() => {
    if (preselectedVenueId) {
      setValue('venue_id', preselectedVenueId);
    }
  }, [preselectedVenueId, setValue]);

  function handleOpenChange(v: boolean) {
    if (!v) {
      reset();
    }
    onOpenChange(v);
  }

  // -------------------------------------------------------
  // Financial calculation
  // -------------------------------------------------------

  const rentalTotal = useMemo(() => {
    if (!selectedVenue) return 0;
    const pt = selectedVenue.pricing_type;
    if (pt === 'per_hour') {
      const hrs = hoursFromTimes(startTime, endTime);
      return selectedVenue.price * hrs;
    }
    if (pt === 'per_person') {
      return selectedVenue.price * (guestCount || 0);
    }
    // flat_rate
    return selectedVenue.price;
  }, [selectedVenue, startTime, endTime, guestCount]);

  const depositRequired = selectedVenue?.deposit ?? 0;

  // -------------------------------------------------------
  // Validation warnings
  // -------------------------------------------------------

  const warnings = useMemo(() => {
    const msgs: string[] = [];

    // Time conflict
    if (venueId && eventDate && startTime && endTime) {
      for (const slot of existingBookings) {
        if (
          slot.status !== 'cancelled' &&
          timesConflict(startTime, endTime, slot.start_time, slot.end_time)
        ) {
          msgs.push(
            `Conflicto de horario con ${slot.code} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)} (${slot.client_name})`,
          );
        }
      }
    }

    // Capacity
    if (selectedVenue && guestCount > selectedVenue.max_capacity) {
      msgs.push(
        `Supera la capacidad máxima del espacio (${selectedVenue.max_capacity} personas)`,
      );
    }

    // Outside venue hours
    if (selectedVenue && startTime && endTime) {
      const open = timeToMinutes(selectedVenue.open_time);
      const close = timeToMinutes(selectedVenue.close_time);
      const start = timeToMinutes(startTime);
      const end = timeToMinutes(endTime);
      if (start < open || end > close) {
        msgs.push(
          `Fuera del horario del espacio (${selectedVenue.open_time.slice(0, 5)}–${selectedVenue.close_time.slice(0, 5)})`,
        );
      }
    }

    // Past date
    if (eventDate && eventDate < today) {
      msgs.push('La fecha del evento es en el pasado');
    }

    return msgs;
  }, [venueId, eventDate, startTime, endTime, existingBookings, selectedVenue, guestCount, today]);

  // -------------------------------------------------------
  // Status preview
  // -------------------------------------------------------

  const statusPreview = useMemo(() => {
    if (depositReceived >= depositRequired && depositRequired > 0) {
      return 'Depósito completo: quedará Confirmada';
    }
    if (depositReceived > 0 && depositReceived < depositRequired) {
      return 'Depósito parcial: quedará Pendiente depósito';
    }
    return 'Quedará Pendiente depósito';
  }, [depositReceived, depositRequired]);

  // -------------------------------------------------------
  // Venue options
  // -------------------------------------------------------

  const venueOptions: EntityOption[] = venues.map((v) => {
    const unit =
      v.pricing_type === 'per_hour'
        ? '/hora'
        : v.pricing_type === 'per_person'
          ? '/persona'
          : '';
    return {
      value: v.id,
      label: `${v.name} · ${PRICING_TYPE_LABELS[v.pricing_type]} · ${formatCurrency(v.price, currency, locale)}${unit}`,
    };
  });

  const methodOptions: EntityOption[] = paymentMethods.map((m) => ({
    value: m.id,
    label: m.name,
  }));

  // -------------------------------------------------------
  // Financial summary text
  // -------------------------------------------------------

  const financialSummaryLine = useMemo(() => {
    if (!selectedVenue) return null;
    const pt = selectedVenue.pricing_type;
    const price = formatCurrency(selectedVenue.price, currency, locale);
    if (pt === 'per_hour') {
      const hrs = hoursFromTimes(startTime, endTime);
      const total = formatCurrency(rentalTotal, currency, locale);
      return `${price} × ${hrs.toFixed(1)} h = ${total}`;
    }
    if (pt === 'per_person') {
      const total = formatCurrency(rentalTotal, currency, locale);
      return `${price} × ${guestCount} personas = ${total}`;
    }
    return `Tarifa fija: ${formatCurrency(rentalTotal, currency, locale)}`;
  }, [selectedVenue, startTime, endTime, guestCount, rentalTotal, currency, locale]);

  // -------------------------------------------------------
  // Submit
  // -------------------------------------------------------

  async function onSubmit(values: BookingFormValues) {
    try {
      await createBooking.mutateAsync({
        venue_id: values.venue_id,
        event_date: values.event_date,
        start_time: values.start_time,
        end_time: values.end_time,
        guest_count: values.guest_count,
        client_name: values.client_name,
        client_phone: values.client_phone,
        client_document: values.client_document || undefined,
        client_email: values.client_email || undefined,
        is_hotel_guest: values.is_hotel_guest,
        room_number: values.is_hotel_guest ? values.room_number : undefined,
        deposit_received: values.deposit_received > 0 ? values.deposit_received : undefined,
        deposit_method_id: values.deposit_method_id || undefined,
        notes: values.notes || undefined,
      });
      handleOpenChange(false);
      onSaved?.();
    } catch {
      // errors handled by hook
    }
  }

  const isSubmitting = createBooking.isPending;
  const hasBlockingWarnings = warnings.length > 0;

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
        Cancelar
      </Button>
      <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting || hasBlockingWarnings}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          'Guardar reserva'
        )}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Nueva reserva de evento"
      size="lg"
      footer={footer}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Validation warnings */}
        {warnings.length > 0 && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Section 1 — Espacio y horario */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Espacio y horario</h3>

          <div className="space-y-1.5">
            <Label>
              Espacio <span className="text-danger">*</span>
            </Label>
            <EntitySelect
              options={venueOptions}
              value={venueId || null}
              onChange={(v) => setValue('venue_id', v ?? '')}
              placeholder="Selecciona un espacio..."
              isLoading={venuesLoading}
              emptyMessage="No hay espacios configurados"
              emptyHref="/eventos?tab=espacios"
            />
            {errors.venue_id && (
              <p className="text-xs text-danger">{errors.venue_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="event-date">
                Fecha <span className="text-danger">*</span>
              </Label>
              <Input
                id="event-date"
                type="date"
                min={today}
                {...register('event_date')}
              />
              {errors.event_date && (
                <p className="text-xs text-danger">{errors.event_date.message}</p>
              )}
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="guest-count">
                Personas <span className="text-danger">*</span>
              </Label>
              <Input
                id="guest-count"
                type="number"
                min={1}
                placeholder={
                  selectedVenue ? `Máximo ${selectedVenue.max_capacity} personas` : 'Personas'
                }
                {...register('guest_count')}
              />
              {errors.guest_count && (
                <p className="text-xs text-danger">{errors.guest_count.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="start-time">
                Hora inicio <span className="text-danger">*</span>
              </Label>
              <Input id="start-time" type="time" {...register('start_time')} />
              {errors.start_time && (
                <p className="text-xs text-danger">{errors.start_time.message}</p>
              )}
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="end-time">
                Hora fin <span className="text-danger">*</span>
              </Label>
              <Input id="end-time" type="time" {...register('end_time')} />
              {errors.end_time && (
                <p className="text-xs text-danger">{errors.end_time.message}</p>
              )}
            </div>
          </div>

          {/* Existing bookings for selected venue+date */}
          {existingBookings.length > 0 && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Ya reservado este día:</p>
              {existingBookings
                .filter((b) => b.status !== 'cancelled')
                .map((b) => (
                  <p key={b.id} className="text-xs text-foreground">
                    {b.code} {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)} ({b.client_name})
                  </p>
                ))}
            </div>
          )}
        </div>

        {/* Section 2 — Quién alquila */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Quién alquila</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="client-name">
                Nombre <span className="text-danger">*</span>
              </Label>
              <Input id="client-name" placeholder="Nombre del cliente" {...register('client_name')} />
              {errors.client_name && (
                <p className="text-xs text-danger">{errors.client_name.message}</p>
              )}
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="client-document">Documento</Label>
              <Input id="client-document" placeholder="CC / NIT..." {...register('client_document')} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="client-phone">
                Teléfono <span className="text-danger">*</span>
              </Label>
              <Input id="client-phone" type="tel" placeholder="+57 300 000 0000" {...register('client_phone')} />
              {errors.client_phone && (
                <p className="text-xs text-danger">{errors.client_phone.message}</p>
              )}
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="client-email">Email</Label>
              <Input id="client-email" type="email" placeholder="correo@ejemplo.com" {...register('client_email')} />
              {errors.client_email && (
                <p className="text-xs text-danger">{errors.client_email.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is-hotel-guest"
              checked={isHotelGuest}
              onCheckedChange={(v) => setValue('is_hotel_guest', !!v)}
            />
            <Label htmlFor="is-hotel-guest" className="cursor-pointer font-normal">
              Es huésped del hotel
            </Label>
          </div>

          {isHotelGuest && (
            <div className="space-y-1.5">
              <Label htmlFor="room-number">Número de habitación</Label>
              <Input
                id="room-number"
                placeholder="Ej. 301"
                {...register('room_number')}
              />
            </div>
          )}
        </div>

        {/* Section 3 — Pago y depósito */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Pago y depósito</h3>

          {/* Live summary */}
          {selectedVenue && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-1.5 text-sm">
              {financialSummaryLine && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alquiler</span>
                  <span className="font-medium tabular-nums">{financialSummaryLine}</span>
                </div>
              )}
              {depositRequired > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Depósito de garantía</span>
                  <span className="tabular-nums">{formatCurrency(depositRequired, currency, locale)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5 font-semibold">
                <span>Total a recibir</span>
                <span className="tabular-nums">
                  {formatCurrency(rentalTotal + depositRequired, currency, locale)}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="deposit-received">Depósito recibido (COP)</Label>
              <Input
                id="deposit-received"
                type="number"
                min={0}
                step={1000}
                {...register('deposit_received')}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>Método de pago del depósito</Label>
              <EntitySelect
                options={methodOptions}
                value={watch('deposit_method_id') || null}
                onChange={(v) => setValue('deposit_method_id', v ?? '')}
                placeholder="Seleccionar método..."
                isLoading={methodsLoading}
                allowClear
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="rental-paid"
              checked={rentalPaid}
              onCheckedChange={(v) => setValue('rental_paid', !!v)}
            />
            <Label htmlFor="rental-paid" className="cursor-pointer font-normal">
              El valor del alquiler ya fue pagado
            </Label>
          </div>

          <p className="text-xs text-muted-foreground">{statusPreview}</p>
        </div>

        {/* Section 4 — Notas */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-foreground">Notas</h3>
          <textarea
            rows={3}
            className="w-full rounded-[var(--radius)] border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Instrucciones especiales, decoración, catering..."
            {...register('notes')}
          />
        </div>
      </form>
    </ResponsiveDialog>
  );
}
