'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateOnly } from '@/lib/dates';
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Moon,
  DollarSign,
  Users,
  LogIn,
  LogOut,
  XCircle,
  Send,
  FileText,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useStayDetail, useStayTasks, useStayStatusHistory } from '@/hooks/use-hotel';
import { useTraSubmissions, useSubmitTra, useGenerateSire } from '@/hooks/use-regulatory';
import { useProfile } from '@/hooks/use-profile';
import { useOrganization } from '@/hooks/use-organization';
import { formatCurrency } from '@/lib/format';
import { getStayBadges, BADGE_STYLES } from '@/lib/stays/badges';
import { todayInTimezone } from '@/lib/dates';
import { StayPhasesStepper, deriveCurrentPhase } from '@/components/hotel/stay-phases-stepper';
import { TeamProgressPanel } from '@/components/hotel/team-progress-panel';
import { StayHistoryTimeline } from '@/components/hotel/stay-history-timeline';
import { FolioTable } from '@/components/hotel/folio-table';
import { ConfirmArrivalModal } from '@/components/hotel/confirm-arrival-modal';
import { AuditLogTimeline } from '@/components/hotel/audit-log-timeline';

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function StayDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const stayId = params.id;

  const { data: stay, isLoading: stayLoading } = useStayDetail(stayId);
  const { data: tasks = [] } = useStayTasks(stayId);
  const { data: history = [] } = useStayStatusHistory(stayId);
  const { data: profile } = useProfile();
  const { timezone } = useOrganization();
  const today = todayInTimezone(timezone);

  const currency = profile?.organization?.currency ?? 'COP';
  const locale = profile?.organization?.locale ?? 'es-CO';

  const [activeTab, setActiveTab] = useState<string>('equipo');
  const [arrivalModalOpen, setArrivalModalOpen] = useState(false);

  // Regulatory hooks
  const { data: traSubmissions = [] } = useTraSubmissions(stayId);
  const submitTra = useSubmitTra();
  const generateSire = useGenerateSire();

  // Derive current phase from status + tasks
  const currentPhase = useMemo(() => {
    if (!stay) return 1;
    return deriveCurrentPhase(
      (stay as { status?: string }).status ?? 'reserved',
      tasks.map((t) => ({ phase: t.phase, status_type: t.status_type })),
    );
  }, [stay, tasks]);

  // Compute nights remaining
  const nightsRemaining = useMemo(() => {
    if (!stay) return 0;
    const today = new Date();
    const checkOut = parseDateOnly(stay.check_out_date);
    const diff = differenceInCalendarDays(checkOut, today);
    return Math.max(0, diff);
  }, [stay]);

  if (stayLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!stay) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Estancia no encontrada</p>
        <Button variant="link" onClick={() => router.push('/hotel/reservas')}>
          Volver a reservas
        </Button>
      </div>
    );
  }

  const stayBadges = getStayBadges(stay, today);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guest = stay.guest as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const room = stay.room as any;
  const balance = stay.balance as { total_charges: number; total_payments: number; balance: number };

  const tabs = [
    { key: 'equipo', label: '¿En qué va mi equipo?' },
    { key: 'folio', label: 'Folio y pagos' },
    { key: 'datos', label: 'Datos personales' },
    { key: 'historial', label: 'Historial' },
    { key: 'cambios', label: 'Cambios' },
    { key: 'incidencias', label: 'Incidencias' },
    { key: 'mensajes', label: 'Mensajes' },
    { key: 'preferencias', label: 'Preferencias' },
    { key: 'encuesta', label: 'Encuesta' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold truncate">
                {guest?.first_name} {guest?.last_name}
              </h1>
              <Badge variant="outline" className={BADGE_STYLES[stayBadges.status.variant]}>{stayBadges.status.label}</Badge>
              <span className="text-xs text-muted-foreground font-mono">{stay.code}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Hab. {room?.number ?? '—'} · {room?.room_type?.name ?? '—'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {stay.status === 'reserved' && (
              <Button size="sm" onClick={() => setArrivalModalOpen(true)}>
                <LogIn className="mr-1.5 h-4 w-4" />
                Confirmar llegada
              </Button>
            )}
            {stay.status === 'checked_in' && (
              <Button size="sm" variant="outline" disabled>
                <LogOut className="mr-1.5 h-4 w-4" />
                Check-out
              </Button>
            )}
            {(stay.status === 'checked_in' || stay.status === 'checked_out') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => submitTra.mutate(stayId)}
                disabled={submitTra.isPending}
              >
                {submitTra.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-4 w-4" />
                )}
                Enviar TRA
                {traSubmissions.length > 0 && (
                  <TraStatusBadge status={traSubmissions[0].status} />
                )}
              </Button>
            )}
            {(stay.status === 'checked_in' || stay.status === 'checked_out') &&
              guest?.nationality &&
              guest.nationality !== 'CO' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  generateSire.mutate({
                    stayId,
                    type: stay.status === 'checked_out' ? 'check_out' : 'check_in',
                  })
                }
                disabled={generateSire.isPending}
              >
                {generateSire.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-1.5 h-4 w-4" />
                )}
                Generar SIRE
              </Button>
            )}
          </div>
        </div>

        {/* Stepper */}
        <StayPhasesStepper currentPhase={currentPhase} />
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <KPICard
            icon={<BedDouble className="h-4 w-4" />}
            label="Habitación"
            value={room?.number ?? '—'}
            sub={room?.room_type?.name}
          />
          <KPICard
            icon={<CalendarDays className="h-4 w-4" />}
            label="Entrada"
            value={format(parseDateOnly(stay.check_in_date), 'd MMM', { locale: es })}
            sub={stay.actual_check_in_at ? format(new Date(stay.actual_check_in_at), 'HH:mm') : 'Pendiente'}
          />
          <KPICard
            icon={<CalendarDays className="h-4 w-4" />}
            label="Salida"
            value={format(parseDateOnly(stay.check_out_date), 'd MMM', { locale: es })}
            sub={stay.actual_check_out_at ? format(new Date(stay.actual_check_out_at), 'HH:mm') : 'Pendiente'}
          />
          <KPICard
            icon={<Moon className="h-4 w-4" />}
            label="Noches"
            value={stay.nights}
            sub={stay.status === 'checked_in' ? `${nightsRemaining} restantes` : undefined}
          />
          <KPICard
            icon={<Users className="h-4 w-4" />}
            label="Huéspedes"
            value={`${stay.adults}A${stay.children > 0 ? ` + ${stay.children}N` : ''}`}
          />
          <KPICard
            icon={<DollarSign className="h-4 w-4" />}
            label="Saldo"
            value={formatCurrency(balance?.balance ?? 0, currency, locale)}
            sub={`Cargado: ${formatCurrency(balance?.total_charges ?? 0, currency, locale)}`}
            highlight={balance?.balance > 0}
          />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'equipo' && <TeamProgressPanel tasks={tasks} />}

        {activeTab === 'folio' && (
          <FolioTable
            charges={stay.folio_charges ?? []}
            payments={stay.payments ?? []}
            balance={balance}
          />
        )}

        {activeTab === 'datos' && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">Datos del huésped principal</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Nombre" value={`${guest?.first_name} ${guest?.last_name}`} />
              <Field label="Documento" value={guest?.document_number ?? '—'} />
              <Field label="Nacionalidad" value={guest?.nationality ?? '—'} />
              <Field label="Teléfono" value={guest?.phone ?? '—'} />
              <Field label="Email" value={guest?.email ?? '—'} />
              <Field label="Fecha de nacimiento" value={guest?.birth_date ? format(parseDateOnly(guest.birth_date), 'd MMM yyyy', { locale: es }) : '—'} />
            </div>
            <Link href={`/hotel/huespedes/${guest?.id}`} className="text-xs text-primary hover:underline">
              Ver ficha completa del huésped
            </Link>
          </div>
        )}

        {activeTab === 'historial' && <StayHistoryTimeline history={history} />}

        {activeTab === 'cambios' && <AuditLogTimeline entityType="stay" entityId={stayId} />}

        {(activeTab === 'incidencias' || activeTab === 'mensajes' || activeTab === 'preferencias' || activeTab === 'encuesta') && (
          <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Disponible en la próxima fase.
          </div>
        )}
      </div>

      {/* Arrival modal */}
      <ConfirmArrivalModal
        open={arrivalModalOpen}
        onOpenChange={setArrivalModalOpen}
        stayId={stayId}
      />
    </div>
  );
}

// -------------------------------------------------------
// Helper components
// -------------------------------------------------------

function KPICard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5 space-y-0.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`text-lg font-bold ${highlight ? 'text-destructive' : ''}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function TraStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    submitted: 'ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400',
    pending: 'ml-1.5 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    error: 'ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const labels: Record<string, string> = {
    submitted: 'enviada',
    pending: 'pendiente',
    error: 'error',
  };
  const cls = styles[status] ?? styles['pending'];
  return <span className={cls}>{labels[status] ?? status}</span>;
}
