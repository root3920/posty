'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  BedDouble,
  DollarSign,
  Shield,
  Clock,
  User,
  FileText,
  Droplets,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { KpiGrid } from '@/components/shared/kpi-grid';
import { KpiCard } from '@/components/shared/kpi-card';
import {
  ContractStatusBadge,
  InstallmentStatusBadge,
  BILLING_CYCLE_LABELS,
  DEPOSIT_STATUS_LABELS,
} from '@/components/contracts/contract-status-badge';
import { RegisterPaymentDialog } from '@/components/contracts/register-payment-dialog';
import { useContractDetail, type ContractInstallment } from '@/hooks/use-contracts';
import { useOrganization } from '@/hooks/use-organization';
import { formatCurrency, formatDate } from '@/lib/format';
import { diffNights, parseDateOnly, formatDateRangeOnly, formatDateOnly } from '@/lib/dates';

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currency, locale } = useOrganization();
  const { data, isLoading, error } = useContractDetail(id);

  const [paymentTarget, setPaymentTarget] = useState<{
    mode: 'installment' | 'deposit';
    targetId: string;
    amount: number;
    label: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'cuotas' | 'datos'>('cuotas');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">No se encontró el contrato</p>
        <Link href="/contratos" className="text-primary mt-2 text-sm hover:underline">
          Volver a contratos
        </Link>
      </div>
    );
  }

  const { contract: c, installments, payments } = data;

  const totalDays = diffNights(c.start_date, c.end_date);
  const today = new Date();
  const startD = parseDateOnly(c.start_date);
  const endD = parseDateOnly(c.end_date);
  const elapsedDays = Math.max(0, Math.round((today.getTime() - startD.getTime()) / 86400000));
  const remainingDays = Math.max(0, Math.round((endD.getTime() - today.getTime()) / 86400000));
  const progressPct = totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0;

  const paidInstallments = installments.filter((i) => i.status === 'paid').length;
  const installmentPct =
    installments.length > 0 ? Math.round((paidInstallments / installments.length) * 100) : 0;

  const depositPayments = payments.filter((p) => p.is_deposit);
  const installmentPayments = payments.filter((p) => !p.is_deposit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/contratos"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-bold">{c.code}</h1>
              <ContractStatusBadge status={c.status} />
            </div>
            <p className="text-muted-foreground text-sm">
              {c.guest_full_name} · Hab. {c.room_number}
            </p>
          </div>
        </div>
        {c.deposit_amount > 0 && c.deposit_status !== 'paid' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPaymentTarget({
                mode: 'deposit',
                targetId: c.id,
                amount: c.deposit_amount - c.deposit_paid_amount,
                label: `Depósito — ${c.code}`,
              })
            }
          >
            <Shield className="mr-2 h-4 w-4" />
            Pagar depósito
          </Button>
        )}
      </div>

      {/* KPIs */}
      <KpiGrid>
        <KpiCard
          icon={<BedDouble className="h-4 w-4" />}
          label="Habitación"
          value={0}
          formatValue={() => `${c.room_number} · ${c.room_type_name}`}
        />
        <KpiCard
          icon={<Calendar className="h-4 w-4" />}
          label="Período"
          value={totalDays}
          formatValue={() => formatDateRangeOnly(c.start_date, c.end_date)}
          subLabel={`${remainingDays} días restantes`}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Precio mensual"
          value={c.monthly_rate}
          formatValue={(v) => formatCurrency(v, currency, locale)}
          subLabel={BILLING_CYCLE_LABELS[c.billing_cycle] + ` · día ${c.payment_day}`}
        />
        <KpiCard
          icon={<Shield className="h-4 w-4" />}
          label="Depósito"
          value={c.deposit_amount}
          formatValue={(v) =>
            v > 0
              ? `${formatCurrency(c.deposit_paid_amount, currency, locale)} / ${formatCurrency(v, currency, locale)}`
              : 'Sin depósito'
          }
          subLabel={c.deposit_amount > 0 ? DEPOSIT_STATUS_LABELS[c.deposit_status] : undefined}
        />
      </KpiGrid>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Progreso del contrato</span>
          <span className="text-muted-foreground">{progressPct}%</span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: 'cuotas' as const, label: 'Cuotas' },
          { key: 'datos' as const, label: 'Datos' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary border-b-2'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Cuotas */}
      {activeTab === 'cuotas' && (
        <div className="space-y-4">
          {/* Installment progress */}
          <div className="flex items-center gap-3">
            <Progress value={installmentPct} className="h-2 flex-1" />
            <span className="text-muted-foreground text-xs">
              {paidInstallments} de {installments.length} pagadas
            </span>
          </div>

          {/* Installments table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-left text-xs">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Período</th>
                  <th className="hidden px-3 py-2 md:table-cell">Vencimiento</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2 text-right">Pagado</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {installments.map((inst) => (
                  <InstallmentRow
                    key={inst.id}
                    inst={inst}
                    currency={currency}
                    locale={locale}
                    onPay={() =>
                      setPaymentTarget({
                        mode: 'installment',
                        targetId: inst.id,
                        amount: inst.total - inst.paid_amount,
                        label: `Cuota ${inst.number} — ${formatDateRangeOnly(inst.period_start, inst.period_end)}`,
                      })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Payments history */}
          {payments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Historial de pagos</h3>
              <div className="space-y-1">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="bg-muted/30 flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-medium">
                        {formatCurrency(p.amount, currency, locale)}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {p.method?.name ?? ''}
                        {p.is_deposit && ' (Depósito)'}
                      </span>
                      {p.reference && (
                        <span className="text-muted-foreground ml-1">— {p.reference}</span>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      {formatDate(p.paid_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Datos */}
      {activeTab === 'datos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoCard
              label="Huésped"
              icon={<User className="h-4 w-4" />}
              items={[
                { label: 'Nombre', value: c.guest_full_name },
                { label: 'Documento', value: c.guest_document_number ? `${c.guest_document_type_code ?? ''} ${c.guest_document_number}` : '—' },
                { label: 'Teléfono', value: c.guest_phone ?? '—' },
                { label: 'Correo', value: c.guest_email ?? '—' },
              ]}
            />

            {c.payer_business_name && (
              <InfoCard
                label="Pagador (empresa)"
                icon={<FileText className="h-4 w-4" />}
                items={[
                  { label: 'Razón social', value: c.payer_business_name },
                  { label: 'NIT', value: c.payer_tax_id ?? '—' },
                ]}
              />
            )}

            <InfoCard
              label="Habitación"
              icon={<BedDouble className="h-4 w-4" />}
              items={[
                { label: 'Número', value: c.room_number },
                { label: 'Tipo', value: c.room_type_name },
                { label: 'Piso', value: c.room_floor ?? '—' },
              ]}
            />

            <InfoCard
              label="Contrato"
              icon={<Calendar className="h-4 w-4" />}
              items={[
                { label: 'Inicio', value: formatDateOnly(c.start_date) },
                { label: 'Fin', value: formatDateOnly(c.end_date) },
                { label: 'Noches', value: `${totalDays}` },
                { label: 'Cobro', value: `${BILLING_CYCLE_LABELS[c.billing_cycle]} · día ${c.payment_day}` },
                { label: 'Impuesto', value: c.tax_rate > 0 ? `${c.tax_rate}%` : 'Sin impuesto' },
              ]}
            />

            <InfoCard
              label="Precios"
              icon={<DollarSign className="h-4 w-4" />}
              items={[
                { label: 'Precio mensual', value: formatCurrency(c.monthly_rate, currency, locale) },
                ...(c.monthly_rate !== c.original_rate
                  ? [{ label: 'Precio original', value: formatCurrency(c.original_rate, currency, locale) }]
                  : []),
                {
                  label: 'Depósito',
                  value: c.deposit_amount > 0
                    ? `${formatCurrency(c.deposit_amount, currency, locale)} (${DEPOSIT_STATUS_LABELS[c.deposit_status]})`
                    : 'Sin depósito',
                },
              ]}
            />

            {c.included_services.length > 0 && (
              <InfoCard
                label="Servicios incluidos"
                icon={<Droplets className="h-4 w-4" />}
                items={c.included_services.map((s) => ({ label: s, value: '✓' }))}
              />
            )}
          </div>

          {c.notes && (
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-muted-foreground text-xs font-medium">Notas</p>
              <p className="text-sm">{c.notes}</p>
            </div>
          )}

          {/* Links */}
          <div className="flex gap-2 text-xs">
            {c.stay_id && (
              <Link
                href={`/hotel/reservas/${c.stay_id}`}
                className="text-primary hover:underline"
              >
                Ver estancia →
              </Link>
            )}
            <Link
              href={`/hotel/huespedes/${c.guest_id}`}
              className="text-primary hover:underline"
            >
              Ficha del huésped →
            </Link>
          </div>
        </div>
      )}

      {/* Payment dialog */}
      {paymentTarget && (
        <RegisterPaymentDialog
          open
          onOpenChange={(open) => {
            if (!open) setPaymentTarget(null);
          }}
          mode={paymentTarget.mode}
          targetId={paymentTarget.targetId}
          suggestedAmount={paymentTarget.amount}
          label={paymentTarget.label}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------
// Installment row
// -------------------------------------------------------

function InstallmentRow({
  inst,
  currency,
  locale,
  onPay,
}: {
  inst: ContractInstallment;
  currency: string;
  locale: string;
  onPay: () => void;
}) {
  const canPay = inst.status !== 'paid' && inst.status !== 'voided';

  return (
    <tr className="border-t">
      <td className="px-3 py-2 text-xs">
        {inst.number}
        {inst.is_prorated && (
          <span className="text-muted-foreground ml-1">
            ({inst.prorated_days}d)
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs">
        {formatDateRangeOnly(inst.period_start, inst.period_end)}
      </td>
      <td className="hidden px-3 py-2 text-xs md:table-cell">
        {formatDateOnly(inst.due_date)}
      </td>
      <td className="px-3 py-2 text-right text-xs tabular-nums">
        {formatCurrency(inst.total, currency, locale)}
      </td>
      <td className="px-3 py-2 text-right text-xs tabular-nums">
        {formatCurrency(inst.paid_amount, currency, locale)}
      </td>
      <td className="px-3 py-2">
        <InstallmentStatusBadge status={inst.status} />
      </td>
      <td className="px-3 py-2">
        {canPay && (
          <Button size="sm" variant="ghost" onClick={onPay} className="h-7 text-xs">
            Pagar
          </Button>
        )}
      </td>
    </tr>
  );
}

// -------------------------------------------------------
// Info card helper
// -------------------------------------------------------

function InfoCard({
  label,
  icon,
  items,
}: {
  label: string;
  icon: React.ReactNode;
  items: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="bg-primary/10 text-primary rounded-md p-1">{icon}</div>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            <span>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
