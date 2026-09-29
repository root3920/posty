'use client';

import { useState, useMemo } from 'react';
import { addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Check, User, BedDouble, DollarSign, ClipboardCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { EntitySelect } from '@/components/shared/entity-select';
import { useProfile } from '@/hooks/use-profile';
import { useGuests } from '@/hooks/use-hotel';
import {
  useAvailableRoomTypesForContract,
  useAvailableRoomsForContract,
  useCreateContract,
} from '@/hooks/use-contracts';
import { formatCurrency, formatDate } from '@/lib/format';
import { INCLUDED_SERVICES_OPTIONS, BILLING_CYCLE_LABELS } from './contract-status-badge';

// -------------------------------------------------------
// Steps
// -------------------------------------------------------

const STEPS = [
  { number: 1, label: 'Huésped', icon: User },
  { number: 2, label: 'Habitación', icon: BedDouble },
  { number: 3, label: 'Pagos', icon: DollarSign },
  { number: 4, label: 'Revisar', icon: ClipboardCheck },
];

const DURATION_CHIPS = [
  { label: '1 mes', months: 1 },
  { label: '3 meses', months: 3 },
  { label: '6 meses', months: 6 },
  { label: '12 meses', months: 12 },
];

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface ContractWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function ContractWizard({ open, onOpenChange }: ContractWizardProps) {
  const { data: profile } = useProfile();
  const currency = profile?.organization?.currency ?? 'COP';
  const locale = profile?.organization?.locale ?? 'es-CO';
  const orgTaxRate = profile?.organization?.tax_rate ?? 0;
  const defaultPaymentDay = profile?.organization?.contract_default_payment_day ?? 1;
  const defaultDepositMonths = profile?.organization?.contract_default_deposit_months ?? 1;

  const createContract = useCreateContract();

  const [step, setStep] = useState(1);

  // Step 1: Guest
  const [guestSearch, setGuestSearch] = useState('');
  const [guestId, setGuestId] = useState<string | null>(null);
  const [payerBusinessName, setPayerBusinessName] = useState('');
  const [payerTaxId, setPayerTaxId] = useState('');
  const [showPayer, setShowPayer] = useState(false);
  const { data: guests = [], isLoading: guestsLoading } = useGuests(guestSearch);

  // Step 2: Room & duration
  const [startDate, setStartDate] = useState('');
  const [durationMonths, setDurationMonths] = useState<number | null>(6);
  const [customEndDate, setCustomEndDate] = useState('');
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [autoAssign, setAutoAssign] = useState(true);

  const endDate = useMemo(() => {
    if (!startDate) return '';
    if (durationMonths === null) return customEndDate;
    return format(addMonths(new Date(startDate + 'T12:00:00'), durationMonths), 'yyyy-MM-dd');
  }, [startDate, durationMonths, customEndDate]);

  const { data: roomTypes = [] } = useAvailableRoomTypesForContract(
    startDate || undefined,
    endDate || undefined,
  );

  const { data: availableRooms = [] } = useAvailableRoomsForContract(
    roomTypeId || undefined,
    startDate || undefined,
    endDate || undefined,
  );

  const selectedType = roomTypes.find((rt) => rt.id === roomTypeId);

  // Step 3: Payment
  const [monthlyRate, setMonthlyRate] = useState(0);
  const [billingCycle, setBillingCycle] = useState<string>('monthly');
  const [paymentDay, setPaymentDay] = useState(defaultPaymentDay);
  const [depositAmount, setDepositAmount] = useState(0);
  const [noDeposit, setNoDeposit] = useState(false);
  const [taxRate, setTaxRate] = useState(orgTaxRate);
  const [includedServices, setIncludedServices] = useState<string[]>([]);
  const [cleaningDays, setCleaningDays] = useState(7);
  const [notes, setNotes] = useState('');

  // Auto-fill rate from selected room type
  function onRoomTypeChange(id: string | null) {
    setRoomTypeId(id);
    setRoomId(null);
    if (id) {
      const rt = roomTypes.find((r) => r.id === id);
      if (rt?.monthly_rate) {
        setMonthlyRate(rt.monthly_rate);
        setDepositAmount(rt.monthly_rate * defaultDepositMonths);
      }
    }
  }

  // Validation
  const step1Valid = !!guestId;
  const step2Valid = !!startDate && !!endDate && !!roomTypeId && (autoAssign || !!roomId);
  const step3Valid = monthlyRate > 0 && paymentDay >= 1 && paymentDay <= 28;

  // Summary calculations
  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
    );
  }, [startDate, endDate]);

  const totalMonths = useMemo(() => {
    if (durationMonths !== null) return durationMonths;
    return Math.round(totalDays / 30 * 10) / 10;
  }, [durationMonths, totalDays]);

  const totalAmount = useMemo(() => {
    return Math.round(monthlyRate * totalMonths * 100) / 100;
  }, [monthlyRate, totalMonths]);

  const selectedGuest = guests.find((g) => g.id === guestId);

  // Submit
  async function handleCreate() {
    if (!guestId || !roomTypeId) return;

    createContract.mutate(
      {
        guest_id: guestId,
        payer_business_name: payerBusinessName || undefined,
        payer_tax_id: payerTaxId || undefined,
        room_type_id: roomTypeId,
        room_id: autoAssign ? undefined : (roomId ?? undefined),
        start_date: startDate,
        end_date: endDate,
        monthly_rate: monthlyRate,
        billing_cycle: billingCycle,
        payment_day: paymentDay,
        tax_rate: taxRate,
        deposit_amount: noDeposit ? 0 : depositAmount,
        included_services: includedServices,
        cleaning_frequency_days: cleaningDays,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      },
    );
  }

  function resetForm() {
    setStep(1);
    setGuestId(null);
    setGuestSearch('');
    setPayerBusinessName('');
    setPayerTaxId('');
    setShowPayer(false);
    setStartDate('');
    setDurationMonths(6);
    setCustomEndDate('');
    setRoomTypeId(null);
    setRoomId(null);
    setAutoAssign(true);
    setMonthlyRate(0);
    setBillingCycle('monthly');
    setPaymentDay(defaultPaymentDay);
    setDepositAmount(0);
    setNoDeposit(false);
    setTaxRate(orgTaxRate);
    setIncludedServices([]);
    setCleaningDays(7);
    setNotes('');
  }

  function toggleService(service: string) {
    setIncludedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service],
    );
  }

  // Footer
  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
      <div>
        {step > 1 && (
          <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
            Anterior
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        {step < 4 ? (
          <Button
            type="button"
            disabled={
              (step === 1 && !step1Valid) ||
              (step === 2 && !step2Valid) ||
              (step === 3 && !step3Valid)
            }
            onClick={() => setStep(step + 1)}
          >
            Siguiente
          </Button>
        ) : (
          <Button
            type="button"
            disabled={createContract.isPending}
            onClick={handleCreate}
          >
            {createContract.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Guardar como borrador'
            )}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo contrato de larga estadía"
      footer={footer}
    >
      {/* Stepper */}
      <div className="flex items-center justify-center gap-1 pb-4 sm:gap-2">
        {STEPS.map((s, i) => {
          const done = s.number < step;
          const current = s.number === step;
          return (
            <div key={s.number} className="flex items-center">
              {i > 0 && (
                <div
                  className={`h-0.5 w-4 sm:w-6 ${done ? 'bg-emerald-500' : 'bg-border'}`}
                />
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
                <span
                  className={`text-[10px] ${current ? 'font-medium' : 'text-muted-foreground'}`}
                >
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 1: Guest */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">¿Para quién es el contrato? *</Label>
            <Input
              placeholder="Buscar por nombre o documento..."
              value={guestSearch}
              onChange={(e) => setGuestSearch(e.target.value)}
            />
            <EntitySelect
              options={guests.map((g) => ({
                value: g.id,
                label: `${g.first_name} ${g.last_name}`,
                description: g.document_number ?? undefined,
              }))}
              value={guestId}
              onChange={(v) => setGuestId(v)}
              placeholder="Seleccionar huésped"
              isLoading={guestsLoading}
              emptyMessage="No se encontraron huéspedes"
            />
          </div>

          {selectedGuest && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium">
                {selectedGuest.first_name} {selectedGuest.last_name}
              </p>
              {selectedGuest.document_number && (
                <p className="text-muted-foreground text-xs">
                  Doc: {selectedGuest.document_number}
                </p>
              )}
              {selectedGuest.phone && (
                <p className="text-muted-foreground text-xs">Tel: {selectedGuest.phone}</p>
              )}
              {selectedGuest.email && (
                <p className="text-muted-foreground text-xs">{selectedGuest.email}</p>
              )}
            </div>
          )}

          <div>
            <button
              type="button"
              className="text-primary text-xs underline"
              onClick={() => setShowPayer(!showPayer)}
            >
              {showPayer ? 'Ocultar datos del pagador' : '¿Paga una empresa? Agregar razón social'}
            </button>
          </div>

          {showPayer && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Razón social</Label>
                <Input
                  value={payerBusinessName}
                  onChange={(e) => setPayerBusinessName(e.target.value)}
                  placeholder="Empresa S.A.S."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">NIT</Label>
                <Input
                  value={payerTaxId}
                  onChange={(e) => setPayerTaxId(e.target.value)}
                  placeholder="900.123.456-7"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Room & Duration */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Fecha de inicio *</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Duración</Label>
            <div className="flex flex-wrap gap-2">
              {DURATION_CHIPS.map((d) => (
                <Button
                  key={d.months}
                  type="button"
                  size="sm"
                  variant={durationMonths === d.months ? 'default' : 'outline'}
                  onClick={() => {
                    setDurationMonths(d.months);
                    setCustomEndDate('');
                  }}
                >
                  {d.label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={durationMonths === null ? 'default' : 'outline'}
                onClick={() => setDurationMonths(null)}
              >
                Personalizado
              </Button>
            </div>
            {durationMonths === null && (
              <div className="space-y-1">
                <Label className="text-xs">Fecha de fin</Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            )}
            {startDate && endDate && (
              <p className="text-muted-foreground text-xs">
                {formatDate(startDate)} — {formatDate(endDate)} · {totalDays} noches
              </p>
            )}
          </div>

          {startDate && endDate && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Tipo de habitación *</Label>
                <EntitySelect
                  options={roomTypes
                    .filter((rt) => rt.available_count > 0)
                    .map((rt) => ({
                      value: rt.id,
                      label: `${rt.name} — ${formatCurrency(rt.monthly_rate, currency, locale)}/mes`,
                      description: `${rt.available_count} disponible(s)`,
                    }))}
                  value={roomTypeId}
                  onChange={onRoomTypeChange}
                  placeholder="Seleccionar tipo"
                  emptyMessage="No hay habitaciones con precio de larga estadía disponibles para todo el período"
                />
              </div>

              {roomTypeId && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="auto-assign"
                      checked={autoAssign}
                      onCheckedChange={(v) => {
                        setAutoAssign(!!v);
                        if (v) setRoomId(null);
                      }}
                    />
                    <Label htmlFor="auto-assign" className="text-xs">
                      Asignar automáticamente
                    </Label>
                  </div>
                  {!autoAssign && (
                    <EntitySelect
                      options={availableRooms.map((r) => ({
                        value: r.id,
                        label: `Hab. ${r.number}${r.floor ? ` — Piso ${r.floor}` : ''}`,
                      }))}
                      value={roomId}
                      onChange={(v) => setRoomId(v)}
                      placeholder="Elegir habitación"
                      emptyMessage="No hay habitaciones disponibles de este tipo"
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3: Payment */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Precio mensual *</Label>
              <Input
                type="number"
                value={monthlyRate || ''}
                onChange={(e) => setMonthlyRate(Number(e.target.value))}
                min={0}
              />
              {selectedType && monthlyRate !== selectedType.monthly_rate && (
                <p className="text-xs text-amber-600">
                  Precio negociado (antes {formatCurrency(selectedType.monthly_rate, currency, locale)})
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Ciclo de cobro</Label>
              <div className="flex gap-2">
                {(['monthly', 'biweekly', 'weekly'] as const).map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={billingCycle === c ? 'default' : 'outline'}
                    onClick={() => setBillingCycle(c)}
                  >
                    {BILLING_CYCLE_LABELS[c]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Día de pago (del mes)</Label>
              <Input
                type="number"
                value={paymentDay}
                onChange={(e) => setPaymentDay(Number(e.target.value))}
                min={1}
                max={28}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Impuesto (%)</Label>
              <Input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                min={0}
                max={100}
                step={0.01}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Depósito de garantía</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="no-deposit"
                checked={noDeposit}
                onCheckedChange={(v) => setNoDeposit(!!v)}
              />
              <Label htmlFor="no-deposit" className="text-xs">
                Sin depósito
              </Label>
            </div>
            {!noDeposit && (
              <Input
                type="number"
                value={depositAmount || ''}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                min={0}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Servicios incluidos</Label>
            <div className="flex flex-wrap gap-2">
              {INCLUDED_SERVICES_OPTIONS.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={includedServices.includes(s)}
                    onCheckedChange={() => toggleService(s)}
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Limpieza cada</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={cleaningDays}
                onChange={(e) => setCleaningDays(Number(e.target.value))}
                min={1}
                max={30}
                className="w-20"
              />
              <span className="text-muted-foreground text-xs">días</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={2}
            />
          </div>

          {/* Live summary */}
          {monthlyRate > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium">Resumen</p>
              <p className="text-muted-foreground text-xs">
                {totalMonths} {totalMonths === 1 ? 'mes' : 'meses'} ·{' '}
                {formatCurrency(monthlyRate, currency, locale)}/mes · Total aprox.{' '}
                {formatCurrency(totalAmount, currency, locale)}
                {!noDeposit && depositAmount > 0 && (
                  <> · Depósito {formatCurrency(depositAmount, currency, locale)}</>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
            <h3 className="font-medium">Resumen del contrato</h3>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Huésped</span>
              <span className="font-medium">
                {selectedGuest
                  ? `${selectedGuest.first_name} ${selectedGuest.last_name}`
                  : '—'}
              </span>

              {payerBusinessName && (
                <>
                  <span className="text-muted-foreground">Pagador</span>
                  <span>{payerBusinessName}{payerTaxId ? ` (${payerTaxId})` : ''}</span>
                </>
              )}

              <span className="text-muted-foreground">Tipo de habitación</span>
              <span>{selectedType?.name ?? '—'}</span>

              <span className="text-muted-foreground">Habitación</span>
              <span>
                {autoAssign
                  ? 'Asignación automática'
                  : availableRooms.find((r) => r.id === roomId)?.number ?? '—'}
              </span>

              <span className="text-muted-foreground">Período</span>
              <span>
                {startDate && endDate
                  ? `${formatDate(startDate)} — ${formatDate(endDate)} (${totalDays} noches)`
                  : '—'}
              </span>

              <span className="text-muted-foreground">Precio mensual</span>
              <span className="font-medium">
                {formatCurrency(monthlyRate, currency, locale)}
              </span>

              <span className="text-muted-foreground">Cobro</span>
              <span>
                {BILLING_CYCLE_LABELS[billingCycle]} · día {paymentDay}
              </span>

              {taxRate > 0 && (
                <>
                  <span className="text-muted-foreground">Impuesto</span>
                  <span>{taxRate}%</span>
                </>
              )}

              <span className="text-muted-foreground">Total estimado</span>
              <span className="font-medium">
                {formatCurrency(totalAmount, currency, locale)}
              </span>

              {!noDeposit && depositAmount > 0 && (
                <>
                  <span className="text-muted-foreground">Depósito de garantía</span>
                  <span>{formatCurrency(depositAmount, currency, locale)}</span>
                </>
              )}

              {includedServices.length > 0 && (
                <>
                  <span className="text-muted-foreground">Servicios incluidos</span>
                  <span>{includedServices.join(', ')}</span>
                </>
              )}

              <span className="text-muted-foreground">Limpieza</span>
              <span>Cada {cleaningDays} días</span>
            </div>

            {notes && (
              <div className="border-t pt-2">
                <span className="text-muted-foreground text-xs">Notas: </span>
                <span className="text-xs">{notes}</span>
              </div>
            )}
          </div>

          <p className="text-muted-foreground text-xs">
            Al guardar se creará el contrato como borrador y se reservará la habitación
            provisionalmente.
          </p>
        </div>
      )}
    </ResponsiveDialog>
  );
}
