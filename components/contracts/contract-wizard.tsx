'use client';

import { useState, useMemo } from 'react';
import { Loader2, Check, User, BedDouble, DollarSign, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { EntitySelect } from '@/components/shared/entity-select';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/use-profile';
import { useGuests } from '@/hooks/use-hotel';
import {
  useAvailableRoomTypesForContract,
  useAvailableRoomsForContract,
  useCreateContract,
} from '@/hooks/use-contracts';
import { formatCurrency } from '@/lib/format';
import { DialogFooterBar } from '@/components/shared/dialog-footer-bar';
import { addMonthsDateOnly, diffNights, formatDateOnly, formatDateRangeOnly } from '@/lib/dates';
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

  const queryClient = useQueryClient();
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
    return addMonthsDateOnly(startDate, durationMonths);
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

  // Inline price setter
  const [inlinePriceTypeId, setInlinePriceTypeId] = useState<string | null>(null);
  const [inlinePrice, setInlinePrice] = useState(0);
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  // Save inline price for a room type
  async function handleSaveInlinePrice() {
    if (!inlinePriceTypeId || !inlinePrice) return;
    setIsSavingPrice(true);
    try {
      const supabase = createClient();
      if (saveAsDefault) {
        await supabase.rpc('set_room_type_monthly_rate', {
          p_room_type_id: inlinePriceTypeId,
          p_monthly_rate: inlinePrice,
        });
      }
      // Set the price locally and select the type
      setMonthlyRate(inlinePrice);
      setDepositAmount(inlinePrice * defaultDepositMonths);
      setInlinePriceTypeId(null);
      // Refetch room types to update the list
      queryClient.invalidateQueries({ queryKey: ['available_room_types_contract'] });
      toast.success('Precio guardado');
    } catch {
      toast.error('Error al guardar el precio');
    } finally {
      setIsSavingPrice(false);
    }
  }

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
    return diffNights(startDate, endDate);
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
    setInlinePriceTypeId(null);
    setInlinePrice(0);
    setSaveAsDefault(true);
  }

  function toggleService(service: string) {
    setIncludedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service],
    );
  }

  // Footer
  const footer = (
    <DialogFooterBar
      secondary={
        step > 1 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
            Anterior
          </Button>
        ) : undefined
      }
      primary={
        step < 4 ? (
          <Button
            type="button"
            size="sm"
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
            size="sm"
            disabled={createContract.isPending}
            onClick={handleCreate}
          >
            {createContract.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Guardar como borrador'
            )}
          </Button>
        )
      }
    />
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo contrato de larga estadía"
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
                {formatDateOnly(startDate)} — {formatDateOnly(endDate)} · {totalDays} noches
              </p>
            )}
          </div>

          {startDate && endDate && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Tipo de habitación *</Label>
                {roomTypes.length === 0 ? (
                  <p className="text-muted-foreground text-xs rounded-lg border border-dashed p-3">
                    No hay tipos de habitación configurados.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {roomTypes.map((rt) => {
                      const isSelected = roomTypeId === rt.id;
                      const hasPrice = rt.monthly_rate != null;
                      const hasAvailability = rt.available_count > 0;
                      const suggestedPrice = Math.round(rt.base_rate * 30 * 0.7);

                      return (
                        <button
                          key={rt.id}
                          type="button"
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'hover:bg-muted/50'
                          } ${!hasAvailability && hasPrice ? 'opacity-60' : ''}`}
                          onClick={() => {
                            if (hasPrice && hasAvailability) {
                              onRoomTypeChange(rt.id);
                            } else if (!hasPrice) {
                              // Select but need to set price first
                              setRoomTypeId(rt.id);
                              setRoomId(null);
                              setInlinePriceTypeId(rt.id);
                              setInlinePrice(suggestedPrice);
                            }
                          }}
                          disabled={hasPrice && !hasAvailability}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{rt.name}</span>
                            {hasPrice ? (
                              <span className="text-sm font-medium tabular-nums">
                                {formatCurrency(rt.monthly_rate!, currency, locale)}/mes
                              </span>
                            ) : (
                              <span className="text-xs text-amber-600">Sin precio de larga estadía</span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            {hasAvailability ? (
                              <span className="text-emerald-600">{rt.available_count} disponible(s)</span>
                            ) : rt.first_available_date ? (
                              <span className="text-amber-600">
                                Sin disponibilidad · Primera libre desde {formatDateOnly(rt.first_available_date)}
                              </span>
                            ) : (
                              <span>Sin habitaciones de este tipo</span>
                            )}
                            <span>· {formatCurrency(rt.base_rate, currency, locale)}/noche</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Inline price setter for types without monthly_rate */}
                {inlinePriceTypeId && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30 space-y-2">
                    <p className="text-xs font-medium">Definir precio de larga estadía</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={inlinePrice || ''}
                        onChange={(e) => setInlinePrice(Number(e.target.value))}
                        min={0}
                        className="w-40"
                        placeholder="Precio mensual"
                      />
                      <span className="text-xs text-muted-foreground">/mes</span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!inlinePrice || inlinePrice <= 0 || isSavingPrice}
                        onClick={handleSaveInlinePrice}
                      >
                        {isSavingPrice ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Guardar'}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Sugerido: {formatCurrency(Math.round((roomTypes.find((r) => r.id === inlinePriceTypeId)?.base_rate ?? 0) * 30 * 0.7), currency, locale)} (30% menos que 30 noches a tarifa normal)
                    </p>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Checkbox checked={saveAsDefault} onCheckedChange={(v) => setSaveAsDefault(!!v)} />
                      Guardar como precio de larga estadía de este tipo
                    </label>
                  </div>
                )}
              </div>

              {roomTypeId && roomTypes.find((r) => r.id === roomTypeId)?.monthly_rate != null && roomTypes.find((r) => r.id === roomTypeId)!.available_count > 0 && (
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
              {selectedType && selectedType.monthly_rate != null && monthlyRate !== selectedType.monthly_rate && (
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
                  ? `${formatDateOnly(startDate)} — ${formatDateOnly(endDate)} (${totalDays} noches)`
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
