'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  BedDouble,
  DollarSign,
  Shield,
  User,
  FileText,
  Droplets,
  MoreHorizontal,
  XCircle,
  RefreshCw,
  FilePlus,
  Send,
  Copy,
  Download,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { KpiGrid } from '@/components/shared/kpi-grid';
import { KpiCard } from '@/components/shared/kpi-card';
import {
  ContractStatusBadge,
  InstallmentStatusBadge,
  BILLING_CYCLE_LABELS,
  DEPOSIT_STATUS_LABELS,
} from '@/components/contracts/contract-status-badge';
import { RegisterPaymentDialog } from '@/components/contracts/register-payment-dialog';
import { TerminateDialog } from '@/components/contracts/terminate-dialog';
import { RenewDialog } from '@/components/contracts/renew-dialog';
import { AmendmentDialog } from '@/components/contracts/amendment-dialog';
import { AuditLogTimeline } from '@/components/hotel/audit-log-timeline';
import {
  useContractDetail,
  useContractAmendments,
  useContractDocuments,
  useSendForSignature,
  type ContractInstallment,
} from '@/hooks/use-contracts';
import { useOrganization } from '@/hooks/use-organization';
import { formatCurrency, formatDate } from '@/lib/format';
import { diffNights, parseDateOnly, formatDateRangeOnly, formatDateOnly } from '@/lib/dates';
import { toast } from 'sonner';

// -------------------------------------------------------
// Page
// -------------------------------------------------------

type ActiveTab = 'cuotas' | 'datos' | 'documentos' | 'otrosi' | 'cambios';

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currency, locale } = useOrganization();
  const { data, isLoading, error } = useContractDetail(id);
  const { data: amendments = [] } = useContractAmendments(id);
  const { data: documents = [] } = useContractDocuments(id);
  const sendForSignature = useSendForSignature();

  const [paymentTarget, setPaymentTarget] = useState<{
    mode: 'installment' | 'deposit';
    targetId: string;
    amount: number;
    label: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('cuotas');
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [amendmentOpen, setAmendmentOpen] = useState(false);

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

  // Signature link (first document with a sign_token)
  const signDoc = documents.find((d) => d.sign_token);
  const signLink = signDoc
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/contrato/firmar/${signDoc.sign_token}`
    : null;

  function handleCopySignLink() {
    if (signLink) {
      navigator.clipboard.writeText(signLink);
      toast.success('Enlace de firma copiado');
    }
  }

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'cuotas', label: 'Cuotas' },
    { key: 'datos', label: 'Datos' },
    { key: 'documentos', label: `Documentos${documents.length > 0 ? ` (${documents.length})` : ''}` },
    { key: 'otrosi', label: `Otrosí${amendments.length > 0 ? ` (${amendments.length})` : ''}` },
    { key: 'cambios', label: 'Cambios' },
  ];

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

        <div className="flex items-center gap-2">
          {/* Deposit button */}
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

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" aria-label="Acciones del contrato" />}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {/* draft actions */}
              {c.status === 'draft' && (
                <>
                  <DropdownMenuItem
                    onClick={() => sendForSignature.mutate(c.id)}
                    disabled={sendForSignature.isPending}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Enviar para firma
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar PDF
                  </DropdownMenuItem>
                </>
              )}

              {/* sent_for_signature actions */}
              {c.status === 'sent_for_signature' && (
                <>
                  <DropdownMenuItem>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar PDF
                  </DropdownMenuItem>
                  {signLink && (
                    <DropdownMenuItem onClick={handleCopySignLink}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar link de firma
                    </DropdownMenuItem>
                  )}
                </>
              )}

              {/* signed / active actions */}
              {(c.status === 'signed' || c.status === 'active') && (
                <>
                  <DropdownMenuItem onClick={() => setTerminateOpen(true)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Terminar contrato
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRenewOpen(true)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Renovar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAmendmentOpen(true)}>
                    <FilePlus className="mr-2 h-4 w-4" />
                    Crear otrosí
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar PDF
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
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

      {/* Tab: Documentos */}
      {activeTab === 'documentos' && (
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="text-muted-foreground h-8 w-8 mb-2" />
              <p className="text-muted-foreground text-sm">No hay documentos generados aún</p>
              {c.status === 'draft' && (
                <p className="text-muted-foreground text-xs mt-1">
                  Envía el contrato para firma para generar el PDF
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-left text-xs">
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Firmado por</th>
                    <th className="px-3 py-2">Fecha firma</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-t">
                      <td className="px-3 py-2 text-xs">
                        <Badge variant="outline" className="text-xs">
                          {doc.doc_type}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {doc.signer_name ?? (doc.signed_at ? '—' : 'Pendiente')}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {doc.signed_at ? formatDate(doc.signed_at) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {doc.pdf_path && (
                            <a
                              href={doc.pdf_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center h-7 px-2.5 text-xs rounded-[min(var(--radius-md),12px)] hover:bg-muted hover:text-foreground transition-colors"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              PDF
                            </a>
                          )}
                          {doc.sign_token && !doc.signed_at && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => {
                                const link = `${window.location.origin}/contrato/firmar/${doc.sign_token}`;
                                navigator.clipboard.writeText(link);
                                toast.success('Enlace copiado');
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copiar link
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Otrosí */}
      {activeTab === 'otrosi' && (
        <div className="space-y-3">
          {(c.status === 'signed' || c.status === 'active') && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setAmendmentOpen(true)}>
                <FilePlus className="mr-2 h-4 w-4" />
                Crear otrosí
              </Button>
            </div>
          )}

          {amendments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="text-muted-foreground h-8 w-8 mb-2" />
              <p className="text-muted-foreground text-sm">No hay otrosíes registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {amendments.map((am) => (
                <div key={am.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Otrosí #{am.amendment_number}</span>
                    <span className="text-muted-foreground text-xs">
                      Vigencia: {formatDateOnly(am.effective_date)}
                    </span>
                  </div>

                  {am.reason && (
                    <p className="text-muted-foreground text-xs">{am.reason}</p>
                  )}

                  <div className="space-y-1">
                    {Object.entries(am.changes).map(([key, value]) => {
                      const prevVal = am.previous_values?.[key];
                      const label = AMENDMENT_FIELD_LABELS[key] ?? key;
                      return (
                        <div key={key} className="text-xs flex gap-2">
                          <span className="text-muted-foreground min-w-[120px]">{label}:</span>
                          {prevVal !== undefined && (
                            <>
                              <span className="line-through text-muted-foreground">
                                {String(prevVal)}
                              </span>
                              <span>→</span>
                            </>
                          )}
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-muted-foreground text-xs">
                    Creado el {formatDate(am.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Cambios */}
      {activeTab === 'cambios' && (
        <AuditLogTimeline entityType="contract" entityId={id} />
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

      {/* Terminate dialog */}
      <TerminateDialog
        open={terminateOpen}
        onOpenChange={setTerminateOpen}
        contractId={c.id}
        contractCode={c.code}
        monthlyRate={c.monthly_rate}
        depositPaid={c.deposit_paid_amount}
        onTerminated={() => router.push('/contratos')}
      />

      {/* Renew dialog */}
      <RenewDialog
        open={renewOpen}
        onOpenChange={setRenewOpen}
        contract={c}
      />

      {/* Amendment dialog */}
      <AmendmentDialog
        open={amendmentOpen}
        onOpenChange={setAmendmentOpen}
        contract={c}
      />
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

// -------------------------------------------------------
// Amendment field labels
// -------------------------------------------------------

const AMENDMENT_FIELD_LABELS: Record<string, string> = {
  monthly_rate: 'Precio mensual',
  end_date: 'Fecha de fin',
  included_services: 'Servicios incluidos',
  cleaning_frequency_days: 'Frecuencia de limpieza',
};
