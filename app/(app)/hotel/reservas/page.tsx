'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, CalendarDays, MoreHorizontal, LogIn } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { CheckInForm } from '@/components/hotel/check-in-form';
import { ConfirmArrivalModal } from '@/components/hotel/confirm-arrival-modal';
import { RoomBadge } from '@/components/shared/room-badge';
import { GuestName } from '@/components/shared/guest-name';
import { StayBadge } from '@/components/shared/stay-badge';
import { PageHeader } from '@/components/shared/page-header';
import { FilterBar } from '@/components/shared/filter-bar';
import { ResponsiveTable, type Column } from '@/components/shared/responsive-table';
import { Fab } from '@/components/layout/fab';
import { createClient } from '@/lib/supabase/client';
import {
  getStayBadges,
  BADGE_STYLES,
  STAY_FILTER_CHIPS,
  filterStaysByChip,
  type StayFilterKey,
} from '@/lib/stays/badges';
import { useOrganization } from '@/hooks/use-organization';
import { todayInTimezone } from '@/lib/dates';
import type { Database } from '@/types/database';

type StayStatus = Database['public']['Enums']['stay_status'];

// -------------------------------------------------------
// stays_view row shape (view not yet in TS types)
// -------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StayViewRow = Record<string, any> & {
  id: string;
  code: string;
  status: StayStatus;
  check_in_date: string;
  check_out_date: string;
  actual_check_in_at?: string | null;
  actual_check_out_at?: string | null;
  nights: number;
  rate_per_night: number;
  room_number: string;
  room_type_name: string | null;
  room_floor: string | null;
  guest_first_name: string;
  guest_last_name: string;
  guest_document_number: string | null;
  channel_name: string | null;
};

// -------------------------------------------------------
// Status options for filter select (labels only)
// -------------------------------------------------------

const STATUS_SELECT_OPTIONS: { value: StayStatus; label: string }[] = [
  { value: 'reserved', label: 'Reservada' },
  { value: 'checked_in', label: 'Hospedado' },
  { value: 'checked_out', label: 'Salió' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'no_show', label: 'No-show' },
];

// -------------------------------------------------------
// Currency formatter
// -------------------------------------------------------

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// -------------------------------------------------------
// Data fetching
// -------------------------------------------------------

async function fetchStaysView(): Promise<StayViewRow[]> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)('stays_view')
    .select('*')
    .order('check_in_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StayViewRow[];
}

// -------------------------------------------------------
// Reservations content
// -------------------------------------------------------

function ReservasContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const { timezone } = useOrganization();
  const today = todayInTimezone(timezone);

  const filterStatus = searchParams.get('estado') ?? '';
  const filterDateFrom = searchParams.get('desde') ?? '';
  const filterDateTo = searchParams.get('hasta') ?? '';

  const [createOpen, setCreateOpen] = useState(false);
  const [arrivalModalOpen, setArrivalModalOpen] = useState(false);
  const [selectedStayId, setSelectedStayId] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<StayFilterKey>('all');

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['stays_view'],
    queryFn: fetchStaysView,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  function openArrivalModal(stayId: string) {
    setSelectedStayId(stayId);
    setArrivalModalOpen(true);
  }

  function handleConfirmed() {
    queryClient.invalidateQueries({ queryKey: ['stays_view'] });
    queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
    queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });
  }

  // Apply URL filters
  let urlFiltered = reservations;
  if (filterStatus) {
    urlFiltered = urlFiltered.filter((r) => r.status === filterStatus);
  }
  if (filterDateFrom) {
    urlFiltered = urlFiltered.filter((r) => r.check_in_date >= filterDateFrom);
  }
  if (filterDateTo) {
    urlFiltered = urlFiltered.filter((r) => r.check_in_date <= filterDateTo);
  }

  // Apply chip filter
  const filtered = filterStaysByChip(urlFiltered, activeChip, today) as StayViewRow[];

  const activeFilterCount = [filterStatus, filterDateFrom, filterDateTo].filter(Boolean).length;

  const columns: Column<StayViewRow>[] = [
    {
      key: 'code',
      header: 'Código',
      priority: 1,
      render: (stay) => (
        <Link href={`/hotel/reservas/${stay.id}`} className="font-mono text-xs text-muted-foreground hover:underline hover:text-foreground">
          {stay.code}
        </Link>
      ),
    },
    {
      key: 'guest',
      header: 'Huésped',
      priority: 1,
      render: (stay) => (
        <GuestName
          firstName={stay.guest_first_name}
          lastName={stay.guest_last_name}
          documentNumber={stay.guest_document_number}
        />
      ),
    },
    {
      key: 'room',
      header: 'Habitación',
      priority: 1,
      render: (stay) => (
        <RoomBadge
          number={stay.room_number}
          typeName={stay.room_type_name ?? undefined}
          floor={stay.room_floor ?? undefined}
        />
      ),
    },
    {
      key: 'check_in',
      header: 'Entrada',
      priority: 2,
      render: (stay) => {
        const badges = getStayBadges(stay, today);
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">
              {format(new Date(`${stay.check_in_date}T12:00:00`), 'd MMM yyyy', { locale: es })}
            </span>
            <StayBadge badge={badges.arrival} />
          </div>
        );
      },
    },
    {
      key: 'check_out',
      header: 'Salida',
      priority: 2,
      render: (stay) => {
        const badges = getStayBadges(stay, today);
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">
              {format(new Date(`${stay.check_out_date}T12:00:00`), 'd MMM yyyy', { locale: es })}
            </span>
            <StayBadge badge={badges.departure} />
          </div>
        );
      },
    },
    {
      key: 'nights',
      header: 'Noches',
      priority: 3,
      render: (stay) => stay.nights,
    },
    {
      key: 'rate',
      header: 'Tarifa',
      priority: 3,
      render: (stay) => <span className="font-medium">{copFormatter.format(stay.rate_per_night)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      priority: 1,
      render: (stay) => {
        const badges = getStayBadges(stay, today);
        return (
          <Badge variant="outline" className={`text-[11px] ${BADGE_STYLES[badges.status.variant]}`}>
            {badges.status.label}
          </Badge>
        );
      },
    },
    {
      key: 'action',
      header: 'Acción',
      priority: 2,
      render: (stay) => {
        const badges = getStayBadges(stay, today);
        if (stay.status !== 'reserved') return null;

        const isConfirmAction = badges.arrival?.action === 'confirm_arrival';
        const isFuture = !isConfirmAction && stay.check_in_date > today;

        if (isConfirmAction) {
          const isPast = stay.check_in_date < today;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant={isPast ? 'outline' : 'default'}
                className="h-7 gap-1.5 text-xs"
                onClick={() => openArrivalModal(stay.id)}
              >
                <LogIn className="h-3.5 w-3.5" />
                Confirmar llegada
              </Button>
            </div>
          );
        }

        if (isFuture) {
          return (
            <div className="flex items-center justify-end gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background text-sm hover:bg-muted focus:outline-none">
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openArrivalModal(stay.id)}>
                    <LogIn className="mr-2 h-4 w-4" />
                    Llegada anticipada
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        }

        return null;
      },
    },
  ];

  function renderCard(stay: StayViewRow) {
    const badges = getStayBadges(stay, today);
    const isConfirmAction = badges.arrival?.action === 'confirm_arrival';
    return (
      <div className={`rounded-xl border bg-card p-4 space-y-3 ${badges.status.dimmed ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <Link href={`/hotel/reservas/${stay.id}`} className="font-mono text-xs text-muted-foreground hover:underline">
            {stay.code}
          </Link>
          <Badge variant="outline" className={`text-[11px] ${BADGE_STYLES[badges.status.variant]}`}>
            {badges.status.label}
          </Badge>
        </div>
        <div>
          <GuestName firstName={stay.guest_first_name} lastName={stay.guest_last_name} documentNumber={stay.guest_document_number} />
        </div>
        <RoomBadge number={stay.room_number} typeName={stay.room_type_name ?? undefined} floor={stay.room_floor ?? undefined} />
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Entrada</p>
            <div className="flex items-center gap-1">
              {format(new Date(`${stay.check_in_date}T12:00:00`), 'd MMM yyyy', { locale: es })}
              <StayBadge badge={badges.arrival} />
            </div>
          </div>
          <div>
            <p className="font-medium text-foreground">Salida</p>
            <div className="flex items-center gap-1">
              {format(new Date(`${stay.check_out_date}T12:00:00`), 'd MMM yyyy', { locale: es })}
              <StayBadge badge={badges.departure} />
            </div>
          </div>
        </div>
        {stay.status === 'reserved' && isConfirmAction && (
          <Button className="w-full gap-1.5" size="sm" onClick={() => openArrivalModal(stay.id)}>
            <LogIn className="h-3.5 w-3.5" />
            Confirmar llegada
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Reservas"
        description="Próximas llegadas y estancias activas"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva reserva
          </Button>
        }
        className="mb-0"
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {STAY_FILTER_CHIPS.map((chip) => {
          const count = filterStaysByChip(urlFiltered, chip.key, today).length;
          const isActive = activeChip === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() => setActiveChip(chip.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {chip.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-foreground'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="py-1">
        <FilterBar activeCount={activeFilterCount}>
          <Select value={filterStatus} onValueChange={(v) => updateParam('estado', v || null)}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {STATUS_SELECT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Input
              type="date"
              className="h-7 w-32 text-xs"
              value={filterDateFrom}
              onChange={(e) => updateParam('desde', e.target.value || null)}
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="date"
              className="h-7 w-32 text-xs"
              value={filterDateTo}
              onChange={(e) => updateParam('hasta', e.target.value || null)}
            />
          </div>
        </FilterBar>
      </div>

      {/* Content */}
      <div>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">No hay reservas que coincidan con los filtros.</p>
          </div>
        ) : (
          <ResponsiveTable
            columns={columns}
            data={filtered}
            renderCard={renderCard}
            keyExtractor={(stay) => stay.id}
          />
        )}
      </div>

      {/* FAB for mobile */}
      <Fab icon={Plus} label="Nueva reserva" onClick={() => setCreateOpen(true)} />

      {/* Create reservation dialog */}
      <CheckInForm open={createOpen} onOpenChange={setCreateOpen} mode="reservation" />

      {/* Confirm arrival modal */}
      <ConfirmArrivalModal
        open={arrivalModalOpen}
        onOpenChange={setArrivalModalOpen}
        stayId={selectedStayId}
        onConfirmed={handleConfirmed}
      />
    </div>
  );
}

// -------------------------------------------------------
// Page export
// -------------------------------------------------------

export default function ReservasPage() {
  return (
    <Suspense>
      <ReservasContent />
    </Suspense>
  );
}
