'use client';

import { useState, useMemo } from 'react';
import { Loader2, Check, MapPin, User, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { Country } from 'react-phone-number-input';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { DialogFooterBar } from '@/components/shared/dialog-footer-bar';
import { EntitySelect } from '@/components/shared/entity-select';
import { TimeSelect } from '@/components/shared/time-select';
import { PhoneInput } from '@/components/shared/phone-input';
import { PRICING_TYPE_LABELS } from '@/components/events/event-status-badge';
import {
  useEventVenues,
  useVenueBookingsForDate,
  useCreateEventBooking,
  type EventVenue,
} from '@/hooks/use-events';
import { usePaymentMethods } from '@/hooks/use-hotel';
import { useProfile } from '@/hooks/use-profile';
import { useDefaultCountry } from '@/components/providers/geo-provider';
import { formatCurrency } from '@/lib/format';
import { formatDateOnly, todayInTimezone } from '@/lib/dates';
import { useOrganization } from '@/hooks/use-organization';

// -------------------------------------------------------
// Steps
// -------------------------------------------------------

const STEPS = [
  { number: 1, label: 'Espacio', icon: MapPin },
  { number: 2, label: 'Cliente', icon: User },
  { number: 3, label: 'Pago', icon: DollarSign },
];

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function hoursFromTimes(start: string, end: string): number {
  if (!start || !end) return 0;
  return (timeToMinutes(end) - timeToMinutes(start)) / 60;
}

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
  const { timezone } = useOrganization();
  const today = todayInTimezone(timezone);
  const orgDefaultCountry = useDefaultCountry();
  const createBooking = useCreateEventBooking();

  const [step, setStep] = useState(1);

  // Step 1: Venue & Schedule
  const [venueId, setVenueId] = useState(preselectedVenueId ?? '');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [guestCount, setGuestCount] = useState(0);

  // Step 2: Client
  const [clientName, setClientName] = useState('');
  const [clientDocument, setClientDocument] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<Country>((orgDefaultCountry ?? 'CO') as Country);
  const [clientEmail, setClientEmail] = useState('');
  const [isHotelGuest, setIsHotelGuest] = useState(false);
  const [roomNumber, setRoomNumber] = useState('');

  // Step 3: Payment
  const [depositReceived, setDepositReceived] = useState(0);
  const [depositMethodId, setDepositMethodId] = useState('');
  const [rentalPaid, setRentalPaid] = useState(false);
  const [notes, setNotes] = useState('');

  // Data
  const { data: venues = [], isLoading: venuesLoading } = useEventVenues();
  const { data: methods = [] } = usePaymentMethods();
  const { data: existingBookings = [] } = useVenueBookingsForDate(
    venueId || undefined,
    eventDate || undefined,
  );

  const selectedVenue = venues.find((v) => v.id === venueId) as EventVenue | undefined;

  // Blocked time ranges for TimeSelect
  const blockedRanges = useMemo(
    () =>
      existingBookings.map((b) => ({
        start: b.start_time.slice(0, 5),
        end: b.end_time.slice(0, 5),
        label: `${b.code} ${b.client_name}`,
      })),
    [existingBookings],
  );

  // Calculate rental total
  const rentalTotal = useMemo(() => {
    if (!selectedVenue || !startTime || !endTime) return 0;
    switch (selectedVenue.pricing_type) {
      case 'per_hour':
        return Math.round(selectedVenue.price * hoursFromTimes(startTime, endTime) * 100) / 100;
      case 'per_person':
        return Math.round(selectedVenue.price * (guestCount || 0) * 100) / 100;
      case 'flat_rate':
        return selectedVenue.price;
      default:
        return 0;
    }
  }, [selectedVenue, startTime, endTime, guestCount]);

  const depositRequired = selectedVenue?.deposit ?? 0;

  // Calculation summary text
  const calcText = useMemo(() => {
    if (!selectedVenue || rentalTotal === 0) return '';
    switch (selectedVenue.pricing_type) {
      case 'per_hour': {
        const h = hoursFromTimes(startTime, endTime);
        return `${formatCurrency(selectedVenue.price, currency, locale)} × ${h} h = ${formatCurrency(rentalTotal, currency, locale)}`;
      }
      case 'per_person':
        return `${formatCurrency(selectedVenue.price, currency, locale)} × ${guestCount} personas = ${formatCurrency(rentalTotal, currency, locale)}`;
      case 'flat_rate':
        return `Tarifa fija: ${formatCurrency(rentalTotal, currency, locale)}`;
      default:
        return '';
    }
  }, [selectedVenue, startTime, endTime, guestCount, rentalTotal, currency, locale]);

  // Status preview
  const statusPreview = useMemo(() => {
    if (depositRequired === 0) return 'Sin depósito requerido: quedará Confirmada';
    if (depositReceived >= depositRequired) return 'Depósito completo: quedará Confirmada';
    if (depositReceived > 0) return `Abono parcial: faltan ${formatCurrency(depositRequired - depositReceived, currency, locale)}`;
    return 'Quedará Pendiente depósito';
  }, [depositRequired, depositReceived, currency, locale]);

  // Validations
  const warnings: string[] = [];
  if (selectedVenue && startTime && endTime) {
    if (timeToMinutes(startTime) < timeToMinutes(selectedVenue.open_time.slice(0, 5))) {
      warnings.push(`El espacio abre a las ${selectedVenue.open_time.slice(0, 5)}`);
    }
    if (timeToMinutes(endTime) > timeToMinutes(selectedVenue.close_time.slice(0, 5))) {
      warnings.push(`El espacio cierra a las ${selectedVenue.close_time.slice(0, 5)}`);
    }
    // Check conflicts
    for (const b of existingBookings) {
      const bStart = timeToMinutes(b.start_time.slice(0, 5));
      const bEnd = timeToMinutes(b.end_time.slice(0, 5));
      const sStart = timeToMinutes(startTime);
      const sEnd = timeToMinutes(endTime);
      if (sStart < bEnd && sEnd > bStart) {
        warnings.push(`Se cruza con ${b.code} de ${b.client_name} (${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)})`);
      }
    }
  }
  if (selectedVenue && guestCount > selectedVenue.max_capacity) {
    warnings.push(`Máximo ${selectedVenue.max_capacity} personas`);
  }
  if (eventDate && eventDate < today) {
    warnings.push('No se pueden reservar fechas pasadas');
  }

  // Step validation
  const step1Valid =
    !!venueId && !!eventDate && !!startTime && !!endTime && guestCount > 0 &&
    timeToMinutes(endTime) > timeToMinutes(startTime) && warnings.length === 0;
  const step2Valid = !!clientName.trim() && !!clientPhone.trim();
  const step3Valid = true; // Payment info is optional

  // Submit
  function handleSubmit() {
    createBooking.mutate(
      {
        venue_id: venueId,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        guest_count: guestCount,
        client_name: clientName,
        client_phone: clientPhone,
        client_document: clientDocument || undefined,
        client_email: clientEmail || undefined,
        is_hotel_guest: isHotelGuest,
        room_number: roomNumber || undefined,
        deposit_received: depositReceived,
        deposit_method_id: depositMethodId || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
          onSaved?.();
        },
      },
    );
  }

  function resetForm() {
    setStep(1);
    setVenueId(preselectedVenueId ?? '');
    setEventDate('');
    setStartTime('');
    setEndTime('');
    setGuestCount(0);
    setClientName('');
    setClientDocument('');
    setClientPhone('');
    setClientEmail('');
    setIsHotelGuest(false);
    setRoomNumber('');
    setDepositReceived(0);
    setDepositMethodId('');
    setRentalPaid(false);
    setNotes('');
  }

  // Status badge
  const statusBadge = useMemo(() => {
    if (depositRequired === 0 || depositReceived >= depositRequired) {
      return <Badge variant="default" className="bg-emerald-600 text-[10px]">Confirmada</Badge>;
    }
    if (depositReceived > 0) {
      return <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px]">Pendiente · faltan {formatCurrency(depositRequired - depositReceived, currency, locale)}</Badge>;
    }
    return <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px]">Pendiente depósito</Badge>;
  }, [depositRequired, depositReceived, currency, locale]);

  // Footer
  const footer = (
    <DialogFooterBar
      summary={
        rentalTotal > 0 ? (
          <>
            <span className="text-xs font-medium">
              Total {formatCurrency(rentalTotal + depositRequired, currency, locale)}
            </span>
            {statusBadge}
          </>
        ) : undefined
      }
      secondary={
        step > 1 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
            Anterior
          </Button>
        ) : undefined
      }
      primary={
        step < 3 ? (
          <Button
            type="button"
            size="sm"
            disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
            onClick={() => setStep(step + 1)}
          >
            Siguiente
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={!step1Valid || !step2Valid || createBooking.isPending}
            onClick={handleSubmit}
          >
            {createBooking.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar reserva'}
          </Button>
        )
      }
    />
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva reserva de evento"
      footer={footer}
      size="lg"
    >
      {/* Stepper */}
      <div className="flex items-center justify-center gap-1 pb-4 sm:gap-2">
        {STEPS.map((s, i) => {
          const done = s.number < step;
          const current = s.number === step;
          return (
            <div key={s.number} className="flex items-center">
              {i > 0 && (
                <div className={`h-0.5 w-4 sm:w-6 ${done ? 'bg-emerald-500' : 'bg-border'}`} />
              )}
              <div className="flex flex-col items-center gap-0.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? 'bg-emerald-500 text-white'
                      : current
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s.number}
                </div>
                <span className={`text-[10px] ${current ? 'font-medium' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 1: Venue & Schedule */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Espacio *</Label>
            <EntitySelect
              options={venues.map((v) => ({
                value: v.id,
                label: `${v.name} · ${PRICING_TYPE_LABELS[v.pricing_type]} · ${formatCurrency(v.price, currency, locale)}`,
                description: `Máx. ${v.max_capacity} personas`,
              }))}
              value={venueId}
              onChange={(v) => { setVenueId(v ?? ''); setStartTime(''); setEndTime(''); }}
              placeholder="Seleccionar espacio"
              isLoading={venuesLoading}
              emptyMessage="No hay espacios activos"
              emptyHref="/eventos?tab=espacios"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Fecha *</Label>
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              min={today}
            />
          </div>

          {selectedVenue && eventDate && (
            <>
              {/* Existing bookings for this venue+date */}
              {existingBookings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Ya reservado ese día:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {existingBookings.map((b) => (
                      <Badge key={b.id} variant="outline" className="text-[10px]">
                        {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)} · {b.client_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Desde *</Label>
                  <TimeSelect
                    value={startTime}
                    onChange={setStartTime}
                    minTime={selectedVenue.open_time.slice(0, 5)}
                    maxTime={selectedVenue.close_time.slice(0, 5)}
                    blockedRanges={blockedRanges}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hasta *</Label>
                  <TimeSelect
                    value={endTime}
                    onChange={setEndTime}
                    minTime={startTime || selectedVenue.open_time.slice(0, 5)}
                    maxTime={selectedVenue.close_time.slice(0, 5)}
                    blockedRanges={blockedRanges}
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Personas *</Label>
            <Input
              type="number"
              value={guestCount || ''}
              onChange={(e) => setGuestCount(Number(e.target.value))}
              min={1}
              max={selectedVenue?.max_capacity}
              placeholder={selectedVenue ? `Máximo ${selectedVenue.max_capacity} personas` : ''}
            />
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
              {warnings.map((w, i) => (
                <p key={i} className="text-xs text-red-600 dark:text-red-400">{w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Client */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Nombre o empresa *</Label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Laura Méndez o Empresa S.A.S."
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Documento / NIT</Label>
            <Input
              value={clientDocument}
              onChange={(e) => setClientDocument(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Celular / WhatsApp *</Label>
            <PhoneInput
              value={clientPhone}
              onChange={(v) => setClientPhone(v ?? '')}
              defaultCountry={phoneCountry}
              onCountryChange={(c) => setPhoneCountry(c)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Correo electrónico</Label>
            <Input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is-hotel-guest"
              checked={isHotelGuest}
              onCheckedChange={(v) => setIsHotelGuest(!!v)}
            />
            <Label htmlFor="is-hotel-guest" className="text-xs">
              Es huésped del hotel
            </Label>
          </div>

          {isHotelGuest && (
            <div className="space-y-1">
              <Label className="text-xs">Habitación</Label>
              <Input
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="Ej. 201"
              />
            </div>
          )}
        </div>
      )}

      {/* Step 3: Payment & Notes */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm">
              {selectedVenue?.name} · {PRICING_TYPE_LABELS[selectedVenue?.pricing_type ?? 'flat_rate']}
            </p>
            {calcText && <p className="text-xs text-muted-foreground">{calcText}</p>}
            {depositRequired > 0 && (
              <p className="text-xs text-muted-foreground">
                Depósito de garantía {formatCurrency(depositRequired, currency, locale)}
              </p>
            )}
            <div className="border-t pt-2">
              <p className="text-sm font-bold tabular-nums">
                Total a recibir {formatCurrency(rentalTotal + depositRequired, currency, locale)}
              </p>
            </div>
          </div>

          {/* Deposit */}
          {depositRequired > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Depósito recibido</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={depositReceived ? formatCurrency(depositReceived, currency, locale) : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setDepositReceived(Number(raw));
                }}
                placeholder="$ 0"
                className="tabular-nums"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setDepositReceived(depositRequired)}
                >
                  Completo ({formatCurrency(depositRequired, currency, locale)})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setDepositReceived(0)}
                >
                  Sin depósito ($ 0)
                </Button>
              </div>

              {depositReceived > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Método de pago</Label>
                  <EntitySelect
                    options={methods.map((m) => ({ value: m.id, label: m.name }))}
                    value={depositMethodId}
                    onChange={(v) => setDepositMethodId(v ?? '')}
                    placeholder="Seleccionar método"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="rental-paid"
              checked={rentalPaid}
              onCheckedChange={(v) => setRentalPaid(!!v)}
            />
            <Label htmlFor="rental-paid" className="text-xs">
              El alquiler ya fue pagado
            </Label>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tipo de evento, decoración, comida, música..."
              rows={2}
            />
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}
