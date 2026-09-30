'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

import { useStayDetail } from '@/hooks/use-hotel';
import { useConvertToLongStay } from '@/hooks/use-contracts';
import { formatCurrency } from '@/lib/format';
import {
  formatDateOnly,
  addMonthsDateOnly,
  diffNights,
} from '@/lib/dates';
import { useOrganization } from '@/hooks/use-organization';
import { todayInTimezone } from '@/lib/dates';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface ConvertModalityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stayId: string | null;
  onConverted?: () => void;
}

const BILLING_CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'weekly', label: 'Semanal' },
];

// -------------------------------------------------------
// Stepper indicator
// -------------------------------------------------------

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < current
              ? 'bg-primary w-6'
              : i === current
              ? 'bg-primary w-4'
              : 'bg-muted w-4'
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">
        {current + 1} / {total}
      </span>
    </div>
  );
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function ConvertModalityDialog({
  open,
  onOpenChange,
  stayId,
  onConverted,
}: ConvertModalityDialogProps) {
  const { timezone } = useOrganization();
  const today = todayInTimezone(timezone);

  const [step, setStep] = useState(0);

  // Form state
  const [endDate, setEndDate] = useState('');
  const [monthlyRate, setMonthlyRate] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [paymentDay, setPaymentDay] = useState('1');
  const [depositAmount, setDepositAmount] = useState('');
  const [applyRetroactive, setApplyRetroactive] = useState(false);

  const { data: stay, isLoading } = useStayDetail(open ? stayId : null);
  const convert = useConvertToLongStay();

  // Suggested end date — default to 3 months from today
  useEffect(() => {
    if (open && !endDate) {
      setEndDate(addMonthsDateOnly(today, 3));
    }
  }, [open, today]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill monthly rate from room type if available
  useEffect(() => {
    if (stay && !monthlyRate) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rt = (stay as any).room?.room_type;
      if (rt?.monthly_rate) {
        setMonthlyRate(String(rt.monthly_rate));
      } else if (stay.rate_per_night) {
        // Estimate: daily × 30
        setMonthlyRate(String(Math.round(stay.rate_per_night * 30)));
      }
    }
  }, [stay]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOpenChange(v: boolean) {
    if (!v) {
      setStep(0);
      setEndDate('');
      setMonthlyRate('');
      setBillingCycle('monthly');
      setPaymentDay('1');
      setDepositAmount('');
      setApplyRetroactive(false);
    }
    onOpenChange(v);
  }

  function setEndDateFromMonths(months: number) {
    setEndDate(addMonthsDateOnly(today, months));
  }

  // Derived values
  const nightsAlreadyStayed = stay
    ? diffNights(stay.check_in_date, today)
    : 0;
  const contractMonths = endDate ? diffNights(today, endDate) / 30 : 0;
  const retroCredit =
    applyRetroactive && stay && monthlyRate
      ? Math.max(
          0,
          nightsAlreadyStayed * stay.rate_per_night -
            nightsAlreadyStayed * (Number(monthlyRate) / 30),
        )
      : 0;

  const canProceedStep1 = !isLoading && !!stay;
  const canProceedStep2 =
    !!endDate &&
    endDate > today &&
    !!monthlyRate &&
    Number(monthlyRate) > 0 &&
    Number(paymentDay) >= 1 &&
    Number(paymentDay) <= 28;

  async function handleConfirm() {
    if (!stayId || !stay) return;
    await convert.mutateAsync({
      stay_id: stayId,
      end_date: endDate,
      monthly_rate: Number(monthlyRate),
      billing_cycle: billingCycle,
      payment_day: Number(paymentDay),
      deposit_amount: depositAmount ? Number(depositAmount) : 0,
      apply_retroactive: applyRetroactive,
    });
    onConverted?.();
    handleOpenChange(false);
  }

  // -------------------------------------------------------
  // Step content
  // -------------------------------------------------------

  function renderStep0() {
    if (isLoading || !stay) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
        </div>
      );
    }

    const rate = formatCurrency(stay.rate_per_night, 'COP');
    const checkIn = formatDateOnly(stay.check_in_date);
    const checkOut = formatDateOnly(stay.check_out_date);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roomNum = (stay as any).room?.number ?? '—';

    return (
      <div className="space-y-5">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Estancia actual
          </p>
          <p className="text-sm font-semibold">
            Estancia corta &middot; {checkIn} – {checkOut} &middot; Hab. {roomNum} &middot; {rate}/noche
          </p>
          {nightsAlreadyStayed > 0 && (
            <p className="text-xs text-muted-foreground">
              {nightsAlreadyStayed} {nightsAlreadyStayed === 1 ? 'noche' : 'noches'} ya disfrutadas
            </p>
          )}
        </div>

        <div className="rounded-lg border border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30 p-4 space-y-2">
          <p className="text-sm font-medium text-violet-700 dark:text-violet-300">
            ¿Por qué convertir a larga estadía?
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
            <li>Tarifa mensual con ciclo de facturación definido</li>
            <li>El huésped sigue en la misma habitación sin hacer check-out</li>
            <li>Contrato generado automáticamente</li>
          </ul>
        </div>

        <Button className="w-full gap-2" onClick={() => setStep(1)} disabled={!canProceedStep1}>
          Convertir a larga estadía
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  function renderStep1() {
    return (
      <div className="space-y-5">
        {/* Duration chips */}
        <div className="space-y-2">
          <Label>Fecha de fin del contrato</Label>
          <div className="flex gap-2 flex-wrap">
            {[3, 6, 12].map((m) => {
              const d = addMonthsDateOnly(today, m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEndDateFromMonths(m)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    endDate === d
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {m} meses
                </button>
              );
            })}
          </div>
          <Input
            type="date"
            value={endDate}
            min={today}
            onChange={(e) => setEndDate(e.target.value)}
          />
          {endDate && endDate > today && (
            <p className="text-xs text-muted-foreground">
              {Math.round(contractMonths * 10) / 10} meses desde hoy
            </p>
          )}
        </div>

        {/* Monthly rate */}
        <div className="space-y-1.5">
          <Label htmlFor="monthly-rate">Tarifa mensual (COP)</Label>
          <Input
            id="monthly-rate"
            type="number"
            min="0"
            placeholder="Ej: 1500000"
            value={monthlyRate}
            onChange={(e) => setMonthlyRate(e.target.value)}
          />
        </div>

        {/* Billing cycle */}
        <div className="space-y-1.5">
          <Label>Ciclo de facturación</Label>
          <div className="flex gap-2">
            {BILLING_CYCLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBillingCycle(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  billingCycle === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Payment day */}
        <div className="space-y-1.5">
          <Label htmlFor="payment-day">Día de pago (1-28)</Label>
          <Input
            id="payment-day"
            type="number"
            min="1"
            max="28"
            value={paymentDay}
            onChange={(e) => setPaymentDay(e.target.value)}
          />
        </div>

        {/* Deposit */}
        <div className="space-y-1.5">
          <Label htmlFor="deposit">Depósito de garantía (opcional)</Label>
          <Input
            id="deposit"
            type="number"
            min="0"
            placeholder="0"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
        </div>

        {/* Retroactive checkbox */}
        {nightsAlreadyStayed > 0 && monthlyRate && Number(monthlyRate) > 0 && (
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <Checkbox
              id="retroactive"
              checked={applyRetroactive}
              onCheckedChange={(v) => setApplyRetroactive(!!v)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <label htmlFor="retroactive" className="text-sm font-medium cursor-pointer">
                Aplicar tarifa de larga estadía desde el primer día
              </label>
              <p className="text-xs text-muted-foreground">
                {nightsAlreadyStayed} noches × {formatCurrency(Number(monthlyRate) / 30, 'COP')}/noche
                {retroCredit > 0 && (
                  <> → nota crédito de <span className="font-semibold text-success">{formatCurrency(retroCredit, 'COP')}</span></>
                )}
                {retroCredit <= 0 && stay && (
                  <> (la tarifa mensual es mayor a la corta; no hay crédito)</>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStep2() {
    if (!stay) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roomNum = (stay as any).room?.number ?? '—';

    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Resumen de la conversión
          </p>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>
                Las <strong>{nightsAlreadyStayed}</strong> {nightsAlreadyStayed === 1 ? 'noche ya disfrutada se mantiene' : 'noches ya disfrutadas se mantienen'} como estancia corta
              </span>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>
                Desde <strong>{formatDateOnly(today)}</strong> empieza el contrato de{' '}
                <strong>{Math.round(contractMonths * 10) / 10} meses</strong> (hasta {formatDateOnly(endDate)})
              </span>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>
                El huésped sigue en la Hab. <strong>{roomNum}</strong>: no se hace check-out
              </span>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span>
                Tarifa <strong>{formatCurrency(Number(monthlyRate), 'COP')}</strong>/mes ·{' '}
                {BILLING_CYCLE_OPTIONS.find((o) => o.value === billingCycle)?.label} · día {paymentDay}
              </span>
            </div>

            {applyRetroactive && retroCredit > 0 && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <span>
                  Nota crédito de <strong className="text-success">{formatCurrency(retroCredit, 'COP')}</strong> por ajuste de tarifa retroactivo
                </span>
              </div>
            )}

            {depositAmount && Number(depositAmount) > 0 && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>
                  Depósito de garantía: <strong>{formatCurrency(Number(depositAmount), 'COP')}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Esta acción es irreversible. Se creará un contrato y la estancia pasará a modalidad larga estadía.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------
  // Footer buttons per step
  // -------------------------------------------------------

  function renderFooter() {
    if (step === 0) {
      return null; // CTA is inline in step 0
    }

    if (step === 1) {
      return (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setStep(0)}>
            Atrás
          </Button>
          <Button onClick={() => setStep(2)} disabled={!canProceedStep2}>
            Continuar
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      );
    }

    // step 2
    return (
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => setStep(1)} disabled={convert.isPending}>
          Atrás
        </Button>
        <Button onClick={handleConfirm} disabled={convert.isPending} className="gap-2">
          {convert.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Convirtiendo...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Confirmar conversión
            </>
          )}
        </Button>
      </div>
    );
  }

  const STEP_TITLES = [
    'Estancia actual',
    'Detalles del contrato',
    'Confirmar conversión',
  ];

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Cambiar modalidad"
      description={STEP_TITLES[step]}
      size="lg"
      footer={renderFooter()}
    >
      {/* Stepper */}
      <div className="mb-5">
        <StepIndicator current={step} total={3} />
      </div>

      {step === 0 && renderStep0()}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
    </ResponsiveDialog>
  );
}
