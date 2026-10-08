'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateOnly, formatDateOnly } from '@/lib/dates';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Globe,
  GitMerge,
  BedDouble,
  Moon,
  DollarSign,
  AlertTriangle,
  MessageCircle,
  Send,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PhoneDisplay } from '@/components/shared/phone-display';
import { KpiGrid } from '@/components/shared/kpi-grid';
import { KpiCard } from '@/components/shared/kpi-card';
import { AuditLogTimeline } from '@/components/hotel/audit-log-timeline';
import { MergeGuestsDialog } from '@/components/hotel/merge-guests-dialog';
import { ContractStatusBadge } from '@/components/contracts/contract-status-badge';
import { SendEmailDialog } from '@/components/email/send-email-dialog';
import { EmailHistory } from '@/components/email/email-history';
import { useGuestEmailThreads } from '@/hooks/use-email-inbox';
import {
  useGuestDetail,
  useGuestStays,
  useGuestStats,
  useDuplicateGuests,
} from '@/hooks/use-hotel';
import { useProfile } from '@/hooks/use-profile';
import { useOrganization } from '@/hooks/use-organization';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/format';
import { getStayBadges, BADGE_STYLES } from '@/lib/stays/badges';
import { todayInTimezone } from '@/lib/dates';

// -------------------------------------------------------
// Contracts hook (local)
// -------------------------------------------------------

function useGuestContracts(guestId: string | null) {
  return useQuery({
    queryKey: ['guest_contracts', guestId],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)('contracts_view')
        .select('*')
        .eq('guest_id', guestId)
        .order('start_date', { ascending: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },
    enabled: !!guestId,
    staleTime: 30_000,
  });
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

type Tab = 'info' | 'estancias' | 'contratos' | 'chat' | 'correo' | 'historial';

const TABS: { key: Tab; label: string }[] = [
  { key: 'info', label: 'Info' },
  { key: 'estancias', label: 'Estancias' },
  { key: 'contratos', label: 'Contratos' },
  { key: 'chat', label: 'Chat' },
  { key: 'correo', label: 'Correo' },
  { key: 'historial', label: 'Historial' },
];

export default function GuestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const guestId = params.id;

  const { data: guest, isLoading: guestLoading } = useGuestDetail(guestId);
  const { data: stays = [], isLoading: staysLoading } = useGuestStays(guestId);
  const { data: contracts = [], isLoading: contractsLoading } = useGuestContracts(guestId);
  const { data: stats, isLoading: statsLoading } = useGuestStats(guestId);
  const { data: duplicates = [] } = useDuplicateGuests();
  const { data: profile } = useProfile();
  const { timezone } = useOrganization();
  const today = todayInTimezone(timezone);

  const currency = profile?.organization?.currency ?? 'COP';
  const locale = profile?.organization?.locale ?? 'es-CO';

  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [mergeOpen, setMergeOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  // Find duplicate matches for this specific guest
  const myDuplicates = duplicates.filter(
    (d) => d.guest_a_id === guestId || d.guest_b_id === guestId,
  );

  if (guestLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Huésped no encontrado</p>
        <Button variant="link" onClick={() => router.push('/hotel/huespedes')}>
          Volver a huéspedes
        </Button>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docType = guest.document_type as any;
  const totalStays = stays.length;
  const isRecurrent = totalStays > 1;
  const guestFullName = `${guest.first_name} ${guest.last_name}`;

  return (
    <div className="space-y-5">
      {/* Duplicate banner */}
      {myDuplicates.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="flex-1 min-w-0 space-y-1.5">
              {myDuplicates.map((d) => {
                const otherName = d.guest_a_id === guestId ? d.guest_b_name : d.guest_a_name;
                return (
                  <div key={`${d.guest_a_id}-${d.guest_b_id}`} className="flex flex-wrap items-center gap-2">
                    <span className="text-warning-foreground">
                      Posible duplicado: <strong>{otherName}</strong>
                      {' '}
                      <span className="text-xs text-muted-foreground">({d.match_type})</span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs"
                      onClick={() => setMergeOpen(true)}
                    >
                      Fusionar
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {guest.first_name?.[0]}{guest.last_name?.[0]}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{guestFullName}</h1>
            <p className="text-xs text-muted-foreground">
              {docType?.code ? `${docType.code} ${guest.document_number}` : guest.document_number ?? 'Sin documento'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRecurrent && (
            <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
              Huésped recurrente · {totalStays} estancias
            </Badge>
          )}
          {guest.email && (
            <Button variant="outline" size="sm" onClick={() => setEmailOpen(true)}>
              <Send className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Enviar correo</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
            <GitMerge className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">Fusionar</span>
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <KpiGrid>
        <KpiCard
          icon={<BedDouble className="h-4 w-4" />}
          label="Total visitas"
          value={stats?.total_stays ?? 0}
          loading={statsLoading}
        />
        <KpiCard
          icon={<Moon className="h-4 w-4" />}
          label="Total noches"
          value={stats?.total_nights ?? 0}
          loading={statsLoading}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Total gastado"
          value={stats?.total_spent ?? 0}
          formatValue={(v) => formatCurrency(v, currency, locale)}
          loading={statsLoading}
        />
        <KpiCard
          icon={<FileText className="h-4 w-4" />}
          label="Contratos"
          value={stats?.total_contracts ?? 0}
          loading={statsLoading}
        />
      </KpiGrid>

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
            {tab.key === 'estancias' ? `Estancias${totalStays > 0 ? ` (${totalStays})` : ''}` :
             tab.key === 'contratos' ? `Contratos${contracts.length > 0 ? ` (${contracts.length})` : ''}` :
             tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold">Información personal</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
            <InfoField icon={<User className="h-4 w-4" />} label="Nombre completo" value={guestFullName} />
            <InfoField icon={<FileText className="h-4 w-4" />} label="Documento" value={docType ? `${docType.code} ${guest.document_number ?? ''}` : guest.document_number ?? '—'} />
            <InfoField icon={<Globe className="h-4 w-4" />} label="Nacionalidad" value={guest.nationality ?? '—'} />
            <InfoField
              icon={<Calendar className="h-4 w-4" />}
              label="Fecha de nacimiento"
              value={guest.birth_date ? format(parseDateOnly(guest.birth_date), 'd MMM yyyy', { locale: es }) : '—'}
            />
            <div className="space-y-0.5">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-4 w-4" /> Teléfono
              </span>
              <PhoneDisplay value={guest.phone} />
            </div>
            <InfoField icon={<Mail className="h-4 w-4" />} label="Email" value={guest.email ?? '—'} />
            <InfoField icon={<MapPin className="h-4 w-4" />} label="Dirección" value={guest.address ?? '—'} />
            <InfoField icon={<MapPin className="h-4 w-4" />} label="Ciudad de origen" value={guest.city_of_origin ?? '—'} />
            <InfoField icon={<Globe className="h-4 w-4" />} label="País de origen" value={guest.country_of_origin ?? '—'} />
          </div>
          {guest.notes && (
            <div className="pt-2 border-t">
              <span className="text-xs text-muted-foreground">Notas</span>
              <p className="text-sm">{guest.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Estancias */}
      {activeTab === 'estancias' && (
        <div className="space-y-3">
          {staysLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : stays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin estancias registradas.</p>
          ) : (
            <div className="space-y-2">
              {stays.map((stay) => {
                const stayBadges = getStayBadges(
                  stay as { status: 'reserved' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'; check_in_date: string; check_out_date: string; actual_check_in_at?: string | null; actual_check_out_at?: string | null },
                  today,
                );
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const modality = (stay as any).modality as string | undefined;
                return (
                  <Link
                    key={stay.id}
                    href={`/hotel/reservas/${stay.id}`}
                    className={`flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 transition-colors ${stayBadges.status.dimmed ? 'opacity-50' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{stay.code}</span>
                        <Badge variant="outline" className={`text-[10px] ${BADGE_STYLES[stayBadges.status.variant]}`}>
                          {stayBadges.status.label}
                        </Badge>
                        {modality && (
                          <Badge variant="outline" className="text-[10px]">
                            {modality === 'long' ? 'Larga' : 'Corta'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm mt-0.5">
                        Hab. {stay.room_number ?? '—'} · {stay.room_type_name ?? '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">
                        {format(parseDateOnly(stay.check_in_date), 'd MMM', { locale: es })}
                        {' → '}
                        {format(parseDateOnly(stay.check_out_date), 'd MMM yyyy', { locale: es })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stay.nights} noche{stay.nights !== 1 ? 's' : ''} · {formatCurrency(stay.rate_per_night * stay.nights, currency, locale)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Contratos */}
      {activeTab === 'contratos' && (
        <div className="space-y-2">
          {contractsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin contratos registrados.</p>
          ) : (
            contracts.map((c) => (
              <Link
                key={c.id}
                href={`/contratos/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                    <ContractStatusBadge status={c.status} />
                  </div>
                  <p className="text-sm mt-0.5">
                    Hab. {c.room_number ?? '—'}
                    {c.room_type_name ? ` · ${c.room_type_name}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">
                    {formatCurrency(c.monthly_rate, currency, locale)}<span className="text-xs text-muted-foreground">/mes</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateOnly(c.start_date)} → {formatDateOnly(c.end_date)}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Tab: Chat */}
      {activeTab === 'chat' && (
        <GuestChatTab guestId={guestId} guestPhone={guest?.phone} />
      )}

      {/* Tab: Correo */}
      {activeTab === 'correo' && (
        <div className="space-y-4">
          {guest.email ? (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span>{guest.email}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Enviar correo
                </Button>
              </div>
              <GuestEmailThreadsList guestId={guestId} />
              <EmailHistory guestId={guestId} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Mail className="h-8 w-8 opacity-40" />
              <p>Este huésped no tiene correo electrónico registrado</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Historial */}
      {activeTab === 'historial' && (
        <AuditLogTimeline entityType="guest" entityId={guestId} />
      )}

      {/* Email dialog */}
      {guest.email && (
        <SendEmailDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          guestId={guestId}
          guestName={guestFullName}
          guestEmail={guest.email}
        />
      )}

      {/* Merge dialog */}
      <MergeGuestsDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        guestId={guestId}
        guestName={guestFullName}
        onMerged={() => router.push('/hotel/huespedes')}
      />
    </div>
  );
}

// -------------------------------------------------------
// Helper
// -------------------------------------------------------

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </span>
      <p className="font-medium">{value}</p>
    </div>
  );
}

// -------------------------------------------------------
// Guest Chat Tab
// -------------------------------------------------------

function GuestChatTab({ guestId, guestPhone }: { guestId: string; guestPhone?: string | null }) {
  const { data: archives = [] } = useQuery({
    queryKey: ['guest_chat_archives', guestId],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('guest_chat_archives')
        .select('*')
        .eq('guest_id', guestId)
        .order('archived_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; phone_e164: string | null; connection_phone: string | null;
        messages: Array<{ direction: string; body: string | null; type: string; created_at: string }>;
        period_start: string | null; period_end: string | null; archived_at: string;
      }>;
    },
    staleTime: 60_000,
  });

  if (archives.length === 0 && !guestPhone) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <MessageCircle className="h-8 w-8 opacity-40" />
        <p>No hay historial de chat para este huésped</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {guestPhone && (
        <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
          <MessageCircle className="h-4 w-4 text-[#25D366]" />
          <span>Abrir chat activo:</span>
          <Link href={`/chat?phone=${encodeURIComponent(guestPhone)}`} className="text-primary hover:underline">
            Ir al chat →
          </Link>
        </div>
      )}

      {archives.map((archive) => (
        <div key={archive.id} className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
            <span>
              Historial de WhatsApp
              {archive.connection_phone && ` · ${archive.connection_phone}`}
            </span>
            <span>{formatDateOnly(archive.archived_at)}</span>
          </div>
          <div className="max-h-64 overflow-y-auto p-3 space-y-1.5">
            {archive.messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.direction === 'out' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[75%] rounded-lg px-2.5 py-1.5 text-xs',
                  msg.direction === 'out' ? 'bg-primary/10 text-foreground' : 'bg-muted text-foreground'
                )}>
                  <p>{msg.body ?? `[${msg.type}]`}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {format(new Date(msg.created_at), 'HH:mm', { locale: es })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------
// Guest Email Threads (shows threaded conversations)
// -------------------------------------------------------

function GuestEmailThreadsList({ guestId }: { guestId: string }) {
  const { data: threads = [], isLoading } = useGuestEmailThreads(guestId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>
    );
  }

  if (threads.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Hilos de correo
      </h3>
      {threads.map((thread) => (
        <Link
          key={thread.id}
          href={`/correo?thread=${thread.id}`}
          className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className={cn(
                'truncate text-sm',
                thread.unread_count > 0 ? 'font-semibold' : 'font-medium',
              )}>
                {thread.subject}
              </span>
              {thread.unread_count > 0 && (
                <Badge variant="default" className="h-4 min-w-4 shrink-0 px-1 text-[10px]">
                  {thread.unread_count}
                </Badge>
              )}
            </div>
            {thread.sender_address && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground pl-5">
                {thread.sender_address}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <Badge variant="outline" className="text-[10px]">
              {thread.status === 'open' ? 'Abierto' : 'Cerrado'}
            </Badge>
            {thread.last_message_at && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {format(new Date(thread.last_message_at), 'dd/MM/yy HH:mm')}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
