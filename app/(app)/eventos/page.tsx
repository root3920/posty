'use client';

import { useState, useMemo, Suspense } from 'react';
import {
  CalendarDays,
  Calendar,
  Users,
  DollarSign,
  Shield,
  Plus,
  Eye,
  ChevronRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiGrid } from '@/components/shared/kpi-grid';
import { KpiCard, KpiCardSkeleton } from '@/components/shared/kpi-card';
import { PageHeader } from '@/components/shared/page-header';
import { ResponsiveTable, type Column } from '@/components/shared/responsive-table';
import { Fab } from '@/components/layout/fab';
import { EntitySelect } from '@/components/shared/entity-select';
import {
  EventBookingStatusBadge,
  DepositStatusBadge,
  PricingTypeBadge,
  PRICING_TYPE_LABELS,
} from '@/components/events/event-status-badge';
import { VenueDialog } from '@/components/events/venue-dialog';
import { EventBookingDialog } from '@/components/events/event-booking-dialog';
import { EventDetailDialog } from '@/components/events/event-detail-dialog';
import { EventCalendar } from '@/components/events/event-calendar';
import {
  useEventVenues,
  useAllEventVenues,
  useEventBookings,
  useEventKpis,
  useUpdateVenue,
  type EventBookingView,
  type EventVenue,
} from '@/hooks/use-events';
import { useOrganization } from '@/hooks/use-organization';
import { todayInTimezone, formatDateOnly, parseDateOnly } from '@/lib/dates';
import { formatCurrency } from '@/lib/format';

// -------------------------------------------------------
// Status filter chips
// -------------------------------------------------------

const STATUS_CHIPS = [
  { key: 'all', label: 'Todas' },
  { key: 'pending_deposit', label: 'Pendiente depósito' },
  { key: 'confirmed', label: 'Confirmadas' },
  { key: 'finished', label: 'Finalizadas' },
  { key: 'cancelled', label: 'Canceladas' },
] as const;

type StatusFilter = (typeof STATUS_CHIPS)[number]['key'];

// -------------------------------------------------------
// Tabs
// -------------------------------------------------------

const TABS = [
  { key: 'reservas', label: 'Reservas' },
  { key: 'calendario', label: 'Calendario' },
  { key: 'espacios', label: 'Espacios' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// -------------------------------------------------------
// Inner page (needs useSearchParams)
// -------------------------------------------------------

function EventosPageInner() {
  const [activeTab, setActiveTab] = useState<TabKey>('reservas');

  // Shared dialogs
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingDialogPreselectedVenueId, setBookingDialogPreselectedVenueId] = useState<string | undefined>(undefined);
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<EventVenue | undefined>(undefined);

  const { timezone, currency, locale } = useOrganization();
  const today = todayInTimezone(timezone);

  const { data: kpis, isLoading: kpisLoading } = useEventKpis();
  const { data: venues = [] } = useEventVenues();
  const { data: bookings = [], isLoading: bookingsLoading } = useEventBookings();

  function openNewBooking(venueId?: string) {
    setBookingDialogPreselectedVenueId(venueId);
    setBookingDialogOpen(true);
  }

  function openEditVenue(venue: EventVenue) {
    setEditingVenue(venue);
    setVenueDialogOpen(true);
  }

  function openNewVenue() {
    setEditingVenue(undefined);
    setVenueDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        description={`Alquiler de espacios · ${formatDateOnly(today, "EEEE, d 'de' MMMM")}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openNewVenue}>
              <Plus className="mr-1.5 h-4 w-4" />
              Agregar espacio
            </Button>
            <Button size="sm" onClick={() => openNewBooking()}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nueva reserva
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <KpiGrid>
        {kpisLoading ? (
          [...Array(5)].map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              icon={<CalendarDays className="h-5 w-5" />}
              label="Eventos hoy"
              value={kpis?.events_today ?? 0}
            />
            <KpiCard
              icon={<Calendar className="h-5 w-5" />}
              label="Reservas esta semana"
              value={kpis?.bookings_this_week ?? 0}
            />
            <KpiCard
              icon={<Users className="h-5 w-5" />}
              label="Personas esperadas"
              value={kpis?.guests_this_week ?? 0}
            />
            <KpiCard
              icon={<Shield className="h-5 w-5" />}
              label="Depósitos pendientes"
              value={kpis?.pending_deposits_amount ?? 0}
              formatValue={(v) => formatCurrency(v, currency, locale)}
              subLabel={kpis ? `${kpis.pending_deposits_count} reserva(s)` : undefined}
            />
            <KpiCard
              icon={<DollarSign className="h-5 w-5" />}
              label="Ingresos alquiler semana"
              value={kpis?.rental_income_this_week ?? 0}
              formatValue={(v) => formatCurrency(v, currency, locale)}
            />
          </>
        )}
      </KpiGrid>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
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
      {activeTab === 'reservas' && (
        <ReservasTab
          bookings={bookings}
          venues={venues}
          isLoading={bookingsLoading}
          today={today}
          currency={currency}
          locale={locale}
          onBookingClick={setDetailBookingId}
        />
      )}

      {activeTab === 'calendario' && (
        <EventCalendar
          bookings={bookings}
          venues={venues}
          onBookingClick={setDetailBookingId}
          timezone={timezone}
        />
      )}

      {activeTab === 'espacios' && (
        <EspaciosTab
          bookings={bookings}
          currency={currency}
          locale={locale}
          onNewVenue={openNewVenue}
          onEditVenue={openEditVenue}
          onNewBooking={openNewBooking}
        />
      )}

      {/* Dialogs */}
      <VenueDialog
        open={venueDialogOpen}
        onOpenChange={(open) => {
          setVenueDialogOpen(open);
          if (!open) setEditingVenue(undefined);
        }}
        venue={editingVenue}
      />

      <EventBookingDialog
        open={bookingDialogOpen}
        onOpenChange={setBookingDialogOpen}
        preselectedVenueId={bookingDialogPreselectedVenueId}
      />

      <EventDetailDialog
        bookingId={detailBookingId}
        open={!!detailBookingId}
        onOpenChange={(open) => {
          if (!open) setDetailBookingId(null);
        }}
      />

      {/* FAB mobile */}
      <Fab icon={Plus} label="Nueva reserva" onClick={() => openNewBooking()} />
    </div>
  );
}

// -------------------------------------------------------
// Tab: Reservas
// -------------------------------------------------------

function ReservasTab({
  bookings,
  venues,
  isLoading,
  today,
  currency,
  locale,
  onBookingClick,
}: {
  bookings: EventBookingView[];
  venues: EventVenue[];
  isLoading: boolean;
  today: string;
  currency: string;
  locale: string;
  onBookingClick: (id: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [venueFilter, setVenueFilter] = useState<string | null>(null);

  const venueOptions = useMemo(
    () =>
      venues.map((v) => ({ value: v.id, label: v.name })),
    [venues],
  );

  // Counts per chip
  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = { all: bookings.length };
    for (const b of bookings) {
      counts[b.status] = (counts[b.status] ?? 0) + 1;
    }
    return counts;
  }, [bookings]);

  const filtered = useMemo(() => {
    let result = bookings;
    if (statusFilter !== 'all') {
      result = result.filter((b) => b.status === statusFilter);
    }
    if (venueFilter) {
      result = result.filter((b) => b.venue_id === venueFilter);
    }
    return result;
  }, [bookings, statusFilter, venueFilter]);

  const columns: Column<EventBookingView>[] = useMemo(
    () => [
      {
        key: 'fecha',
        header: 'Fecha',
        priority: 1,
        render: (row) => {
          const isToday = row.event_date === today;
          return (
            <span className={isToday ? 'font-semibold text-primary' : ''}>
              {isToday ? 'Hoy' : formatDateOnly(row.event_date)}
            </span>
          );
        },
      },
      {
        key: 'horario',
        header: 'Horario',
        priority: 1,
        render: (row) => (
          <span className="tabular-nums text-sm">
            {row.start_time.slice(0, 5)} – {row.end_time.slice(0, 5)}
          </span>
        ),
      },
      {
        key: 'espacio',
        header: 'Espacio',
        priority: 2,
        render: (row) => <span>{row.venue_name}</span>,
      },
      {
        key: 'cliente',
        header: 'Cliente',
        priority: 1,
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.client_name}</span>
            {row.client_phone && (
              <span className="text-xs text-muted-foreground">{row.client_phone}</span>
            )}
          </div>
        ),
      },
      {
        key: 'personas',
        header: 'Personas',
        priority: 2,
        render: (row) => {
          const over = row.guest_count > row.venue_max_capacity;
          return (
            <span className={over ? 'font-semibold text-destructive' : ''}>
              {row.guest_count} / {row.venue_max_capacity}
            </span>
          );
        },
      },
      {
        key: 'total',
        header: 'Total',
        priority: 3,
        render: (row) => (
          <div className="flex flex-col">
            <span className="tabular-nums font-medium">
              {formatCurrency(row.rental_total, currency, locale)}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.rental_paid ? 'Pagado' : 'Por cobrar'}
            </span>
          </div>
        ),
      },
      {
        key: 'deposito',
        header: 'Depósito',
        priority: 3,
        render: (row) => (
          <div className="flex flex-col gap-0.5">
            <span className="tabular-nums text-sm">
              {formatCurrency(row.deposit_received, currency, locale)}
            </span>
            <DepositStatusBadge status={row.deposit_status} />
          </div>
        ),
      },
      {
        key: 'estado',
        header: 'Estado',
        priority: 1,
        render: (row) => <EventBookingStatusBadge status={row.status} />,
      },
      {
        key: 'action',
        header: '',
        priority: 1,
        render: (row) => (
          <button
            type="button"
            onClick={() => onBookingClick(row.id)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Ver detalle"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ),
      },
    ],
    [today, currency, locale, onBookingClick],
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_CHIPS.map((chip) => (
            <Badge
              key={chip.key}
              variant={statusFilter === chip.key ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setStatusFilter(chip.key)}
            >
              {chip.label}
              {chipCounts[chip.key === 'all' ? 'all' : chip.key] != null && (
                <span className="ml-1 opacity-70">
                  ({chip.key === 'all' ? chipCounts.all : (chipCounts[chip.key] ?? 0)})
                </span>
              )}
            </Badge>
          ))}
        </div>
        <div className="w-44">
          <EntitySelect
            options={venueOptions}
            value={venueFilter}
            onChange={setVenueFilter}
            placeholder="Todos los espacios"
            allowClear
            clearLabel="Todos los espacios"
            size="sm"
          />
        </div>
      </div>

      {/* Table / cards */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No hay reservas con este filtro.</p>
        </div>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={filtered}
          keyExtractor={(row) => row.id}
          renderCard={(row) => (
            <button
              type="button"
              onClick={() => onBookingClick(row.id)}
              className="w-full rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/30"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{row.code}</span>
                <EventBookingStatusBadge status={row.status} />
              </div>
              <div className="mb-1 flex items-center gap-2 text-sm">
                <span className="font-medium">{row.venue_name}</span>
                <span className="text-muted-foreground">·</span>
                <span className={row.event_date === today ? 'font-semibold text-primary' : ''}>
                  {row.event_date === today ? 'Hoy' : formatDateOnly(row.event_date)}
                </span>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {row.start_time.slice(0, 5)} – {row.end_time.slice(0, 5)}
                </span>
              </div>
              <p className="text-sm font-medium">{row.client_name}</p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{row.guest_count} personas</span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-semibold">
                    {formatCurrency(row.rental_total, currency, locale)}
                  </span>
                  <DepositStatusBadge status={row.deposit_status} />
                </div>
              </div>
            </button>
          )}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------
// Tab: Espacios
// -------------------------------------------------------

function EspaciosTab({
  bookings,
  currency,
  locale,
  onNewVenue,
  onEditVenue,
  onNewBooking,
}: {
  bookings: EventBookingView[];
  currency: string;
  locale: string;
  onNewVenue: () => void;
  onEditVenue: (venue: EventVenue) => void;
  onNewBooking: (venueId: string) => void;
}) {
  const { data: allVenues = [], isLoading } = useAllEventVenues();
  const updateVenue = useUpdateVenue();

  // Count bookings this week per venue
  const bookingsThisWeek = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startStr = startOfWeek.toISOString().slice(0, 10);
    const endStr = endOfWeek.toISOString().slice(0, 10);

    const counts: Record<string, number> = {};
    for (const b of bookings) {
      if (
        b.event_date >= startStr &&
        b.event_date <= endStr &&
        b.status !== 'cancelled'
      ) {
        counts[b.venue_id] = (counts[b.venue_id] ?? 0) + 1;
      }
    }
    return counts;
  }, [bookings]);

  const pricingUnitLabel: Record<string, string> = {
    per_hour: '/hora',
    per_person: '/persona',
    flat_rate: '',
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {allVenues.map((venue) => (
        <div key={venue.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{venue.name}</p>
              {venue.description && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {venue.description}
                </p>
              )}
            </div>
            <PricingTypeBadge pricingType={venue.pricing_type} />
          </div>

          {/* Price + deposit */}
          <div className="flex items-end gap-4">
            <div>
              <p className="text-2xl font-semibold font-heading tabular-nums leading-none">
                {formatCurrency(venue.price, currency, locale)}
                <span className="ml-0.5 text-sm font-normal text-muted-foreground">
                  {pricingUnitLabel[venue.pricing_type] ?? ''}
                </span>
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              Depósito:{' '}
              <span className="font-medium tabular-nums">
                {formatCurrency(venue.deposit, currency, locale)}
              </span>
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Máx. {venue.max_capacity} personas
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {venue.open_time.slice(0, 5)} – {venue.close_time.slice(0, 5)}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {bookingsThisWeek[venue.id] ?? 0} reserva(s) esta semana
            </span>
          </div>

          {/* Active toggle + actions */}
          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={venue.is_active}
                onCheckedChange={(checked) =>
                  updateVenue.mutate({ id: venue.id, is_active: checked })
                }
                disabled={updateVenue.isPending}
              />
              <span className="text-xs text-muted-foreground">
                {venue.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onEditVenue(venue)}
              >
                Editar
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => onNewBooking(venue.id)}
                disabled={!venue.is_active}
              >
                Reservar
              </Button>
            </div>
          </div>
        </div>
      ))}

      {/* Add venue card */}
      <button
        type="button"
        onClick={onNewVenue}
        className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="h-8 w-8" />
        <span className="text-sm font-medium">Agregar espacio</span>
      </button>
    </div>
  );
}

// -------------------------------------------------------
// Page wrapper with Suspense
// -------------------------------------------------------

export default function EventosPage() {
  return (
    <Suspense>
      <EventosPageInner />
    </Suspense>
  );
}
