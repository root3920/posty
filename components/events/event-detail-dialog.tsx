'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Loader2,
  MessageCircle,
  User,
  Phone,
  Mail,
  Building2,
  Calendar,
  Clock,
  Users,
  FileText,
  History,
} from 'lucide-react';

import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { EntitySelect, type EntityOption } from '@/components/shared/entity-select';
import { PhoneDisplay } from '@/components/shared/phone-display';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { formatCurrency } from '@/lib/format';
import { formatDateOnly, parseDateOnly } from '@/lib/dates';
import { useProfile } from '@/hooks/use-profile';
import { usePaymentMethods } from '@/hooks/use-hotel';
import {
  useEventBookingDetail,
  useRegisterEventDeposit,
  useMarkRentalPaid,
  useFinalizeEvent,
  useCancelEventBooking,
  useReturnEventDeposit,
  useRetainEventDeposit,
} from '@/hooks/use-events';
import { EventBookingStatusBadge, DepositStatusBadge } from './event-status-badge';

// -------------------------------------------------------
// Action labels for history
// -------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  created: 'Reserva creada',
  deposit_registered: 'Depósito registrado',
  deposit_returned: 'Depósito devuelto',
  deposit_retained: 'Depósito retenido',
  rental_paid: 'Alquiler marcado como pagado',
  finalized: 'Evento finalizado',
  cancelled: 'Reserva cancelada',
  status_changed: 'Estado actualizado',
};

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface EventDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
}

// -------------------------------------------------------
// Loading skeleton
// -------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-5 w-1/2 rounded bg-muted" />
      <div className="h-4 w-1/3 rounded bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-4 rounded bg-muted" />
        ))}
      </div>
      <div className="h-20 rounded bg-muted" />
    </div>
  );
}

// -------------------------------------------------------
// InfoRow helper
// -------------------------------------------------------

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function EventDetailDialog({ open, onOpenChange, bookingId }: EventDetailDialogProps) {
  const { data: profile } = useProfile();
  const currency = profile?.organization?.currency ?? 'COP';
  const locale = profile?.organization?.locale ?? 'es-CO';

  const { data, isLoading } = useEventBookingDetail(bookingId ?? undefined);
  const booking = data?.booking ?? null;
  const history = data?.history ?? [];

  const { data: paymentMethods = [], isLoading: methodsLoading } = usePaymentMethods();

  // Mutations
  const registerDeposit = useRegisterEventDeposit();
  const markRentalPaid = useMarkRentalPaid();
  const finalizeEvent = useFinalizeEvent();
  const cancelBooking = useCancelEventBooking();
  const returnDeposit = useReturnEventDeposit();
  const retainDeposit = useRetainEventDeposit();

  // Inline form state — register deposit
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethodId, setDepositMethodId] = useState<string | null>(null);

  // Inline form state — retain deposit
  const [showRetainForm, setShowRetainForm] = useState(false);
  const [retainReason, setRetainReason] = useState('');

  // Inline form state — cancel
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const isActioning =
    registerDeposit.isPending ||
    markRentalPaid.isPending ||
    finalizeEvent.isPending ||
    cancelBooking.isPending ||
    returnDeposit.isPending ||
    retainDeposit.isPending;

  const methodOptions: EntityOption[] = paymentMethods.map((m) => ({
    value: m.id,
    label: m.name,
  }));

  // -------------------------------------------------------
  // Handlers
  // -------------------------------------------------------

  async function handleRegisterDeposit() {
    if (!booking || !depositMethodId) return;
    await registerDeposit.mutateAsync({
      booking_id: booking.id,
      amount: Number(depositAmount),
      method_id: depositMethodId,
    });
    setShowDepositForm(false);
    setDepositAmount('');
    setDepositMethodId(null);
  }

  async function handleMarkRentalPaid() {
    if (!booking) return;
    await markRentalPaid.mutateAsync({ booking_id: booking.id });
  }

  async function handleFinalize() {
    if (!booking) return;
    await finalizeEvent.mutateAsync({ booking_id: booking.id });
  }

  async function handleCancel() {
    if (!booking) return;
    await cancelBooking.mutateAsync({ booking_id: booking.id, reason: cancelReason || undefined });
    setShowCancelForm(false);
    setCancelReason('');
  }

  async function handleReturnDeposit() {
    if (!booking) return;
    await returnDeposit.mutateAsync({ booking_id: booking.id });
  }

  async function handleRetainDeposit() {
    if (!booking || !retainReason.trim()) return;
    await retainDeposit.mutateAsync({ booking_id: booking.id, reason: retainReason });
    setShowRetainForm(false);
    setRetainReason('');
  }

  function handleWhatsApp() {
    if (!booking) return;
    const digits = booking.client_phone.replace(/\D/g, '');
    const formattedDate = formatDateOnly(booking.event_date, 'EEEE d \'de\' MMMM');
    const msg =
      `Hola ${booking.client_name}, te confirmamos tu reserva de evento ${booking.code} ` +
      `en ${booking.venue_name} para el ${formattedDate} de ${booking.start_time.slice(0, 5)} a ${booking.end_time.slice(0, 5)}. ` +
      `Total: ${formatCurrency(booking.rental_total, currency, locale)}. ` +
      `Depósito: ${formatCurrency(booking.deposit_required, currency, locale)}.`;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // -------------------------------------------------------
  // Date formatting helpers
  // -------------------------------------------------------

  function formatLongDate(dateStr: string) {
    return format(parseDateOnly(dateStr), "EEEE, d 'de' MMMM", { locale: es });
  }

  function formatShortDate(dateStr: string) {
    return formatDateOnly(dateStr, 'EEE d MMM');
  }

  // -------------------------------------------------------
  // Footer
  // -------------------------------------------------------

  const footer = booking ? (
    <div className="flex flex-col gap-2">
      {/* Status-conditional action buttons */}
      <div className="flex flex-wrap gap-2">
        {booking.status === 'pending_deposit' && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDepositForm(!showDepositForm)}
              disabled={isActioning}
            >
              Registrar depósito
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowCancelForm(!showCancelForm)}
              disabled={isActioning}
            >
              Cancelar reserva
            </Button>
          </>
        )}

        {booking.status === 'confirmed' && (
          <>
            {!booking.rental_paid && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkRentalPaid}
                disabled={isActioning}
              >
                {markRentalPaid.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Marcar alquiler como pagado
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleFinalize}
              disabled={isActioning}
            >
              {finalizeEvent.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Finalizar evento
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowCancelForm(!showCancelForm)}
              disabled={isActioning}
            >
              Cancelar reserva
            </Button>
          </>
        )}

        {booking.status === 'finished' && booking.deposit_received > 0 && booking.deposit_status === 'received' && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReturnDeposit}
              disabled={isActioning}
            >
              {returnDeposit.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Devolver depósito
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowRetainForm(!showRetainForm)}
              disabled={isActioning}
            >
              Retener por daños
            </Button>
          </>
        )}

        {booking.status !== 'finished' && booking.status !== 'cancelled' && (
          <Button size="sm" variant="outline" onClick={handleWhatsApp}>
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
            Enviar por WhatsApp
          </Button>
        )}
      </div>

      {/* Inline: register deposit */}
      {showDepositForm && (
        <div className="rounded-lg border bg-muted/50 p-3 space-y-3">
          <p className="text-sm font-medium">Registrar depósito</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="deposit-amount-inline" className="text-xs">Monto (COP)</Label>
              <Input
                id="deposit-amount-inline"
                type="number"
                min={0}
                step={1000}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label className="text-xs">Método de pago</Label>
              <EntitySelect
                options={methodOptions}
                value={depositMethodId}
                onChange={setDepositMethodId}
                placeholder="Seleccionar..."
                isLoading={methodsLoading}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleRegisterDeposit}
              disabled={!depositAmount || !depositMethodId || registerDeposit.isPending}
            >
              {registerDeposit.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowDepositForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Inline: retain deposit */}
      {showRetainForm && (
        <div className="rounded-lg border bg-muted/50 p-3 space-y-3">
          <p className="text-sm font-medium">Retener depósito por daños</p>
          <div className="space-y-1">
            <Label htmlFor="retain-reason" className="text-xs">Motivo</Label>
            <textarea
              id="retain-reason"
              rows={2}
              className="w-full rounded-[var(--radius)] border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Describe los daños o motivo de retención..."
              value={retainReason}
              onChange={(e) => setRetainReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRetainDeposit}
              disabled={!retainReason.trim() || retainDeposit.isPending}
            >
              {retainDeposit.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Confirmar retención
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowRetainForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Inline: cancel booking */}
      {showCancelForm && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 space-y-3">
          <p className="text-sm font-medium text-danger">Cancelar reserva</p>
          <div className="space-y-1">
            <Label htmlFor="cancel-reason-inline" className="text-xs">Motivo (opcional)</Label>
            <textarea
              id="cancel-reason-inline"
              rows={2}
              className="w-full rounded-[var(--radius)] border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Motivo de cancelación..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelBooking.isPending}
            >
              {cancelBooking.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Confirmar cancelación
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCancelForm(false)}>
              Volver
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end border-t pt-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cerrar
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex justify-end">
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        Cerrar
      </Button>
    </div>
  );

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------

  const title = booking?.code ?? (isLoading ? 'Cargando...' : 'Detalle de reserva');
  const description = booking
    ? `${booking.venue_name} · ${formatShortDate(booking.event_date)}`
    : undefined;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="lg"
      footer={footer}
    >
      {isLoading ? (
        <DetailSkeleton />
      ) : !booking ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No se encontró la reserva.
        </p>
      ) : (
        <div className="space-y-6">
          {/* Status badges */}
          <div className="flex flex-wrap items-center gap-2">
            <EventBookingStatusBadge status={booking.status} />
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              Depósito: <DepositStatusBadge status={booking.deposit_status} />
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow
              icon={Building2}
              label="Espacio"
              value={booking.venue_name}
            />
            <InfoRow
              icon={Calendar}
              label="Fecha"
              value={formatLongDate(booking.event_date)}
            />
            <InfoRow
              icon={Clock}
              label="Horario"
              value={`${booking.start_time.slice(0, 5)} – ${booking.end_time.slice(0, 5)}`}
            />
            <InfoRow
              icon={Users}
              label="Personas"
              value={`${booking.guest_count} / ${booking.venue_max_capacity} máx.`}
            />
          </div>

          {/* Client info */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Datos del cliente
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow icon={User} label="Nombre" value={booking.client_name} />
              {booking.client_document && (
                <InfoRow icon={FileText} label="Documento" value={booking.client_document} />
              )}
              <div className="flex items-center gap-2 text-xs">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Teléfono</span>
                <PhoneDisplay value={booking.client_phone} className="ml-auto" />
              </div>
              {booking.client_email && (
                <InfoRow icon={Mail} label="Email" value={booking.client_email} />
              )}
              {booking.is_hotel_guest && (
                <InfoRow
                  icon={Building2}
                  label="Huésped del hotel"
                  value={booking.room_number ? `Hab. ${booking.room_number}` : 'Sí'}
                />
              )}
            </div>
          </div>

          {/* Financial info */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Financiero
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Alquiler</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">
                    {formatCurrency(booking.rental_total, currency, locale)}
                  </span>
                  {booking.rental_paid ? (
                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                      Pagado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">
                      Pendiente
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Depósito requerido</span>
                <span className="tabular-nums">
                  {formatCurrency(booking.deposit_required, currency, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Depósito recibido</span>
                <span className="tabular-nums">
                  {formatCurrency(booking.deposit_received, currency, locale)}
                </span>
              </div>
              {booking.deposit_status && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estado depósito</span>
                  <DepositStatusBadge status={booking.deposit_status} />
                </div>
              )}
              {booking.deposit_retained_reason && (
                <div className="rounded border-l-4 border-red-400 bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                  Motivo retención: {booking.deposit_retained_reason}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {booking.notes && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notas
              </p>
              <p className="text-sm text-foreground">{booking.notes}</p>
            </div>
          )}

          {/* History timeline */}
          {history.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Historial
                </p>
              </div>
              <div className="relative space-y-0 pl-6">
                {/* Vertical line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />

                {history.map((entry) => {
                  const label = ACTION_LABELS[entry.action] ?? entry.action;
                  return (
                    <div key={entry.id} className="relative flex items-start gap-3 pb-4">
                      {/* Dot */}
                      <div className="absolute left-[-15px] top-1.5 h-3 w-3 rounded-full bg-muted-foreground ring-2 ring-background" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{label}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>
                            {format(new Date(entry.created_at), "d MMM yyyy · HH:mm", { locale: es })}
                          </span>
                          {entry.actor_name && (
                            <>
                              <span>·</span>
                              <span>{entry.actor_name}</span>
                            </>
                          )}
                        </div>
                        {entry.detail && Object.keys(entry.detail).length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {Object.entries(entry.detail)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </ResponsiveDialog>
  );
}
