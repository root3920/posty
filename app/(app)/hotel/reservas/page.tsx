'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { format, isToday, isTomorrow, isPast, isFuture } from 'date-fns';
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
import { PageHeader } from '@/components/shared/page-header';
import { FilterBar } from '@/components/shared/filter-bar';
import { ResponsiveTable, type Column } from '@/components/shared/responsive-table';
import { Fab } from '@/components/layout/fab';
import { createClient } from '@/lib/supabase/client';
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
// Status config
// -------------------------------------------------------

const STATUS_CONFIG: Record<StayStatus, { label: string; variant: 'default' | 'outline' | 'secondary'; className: string }> = {
  reserved: {
    label: 'Reservada',
    variant: 'outline',
    className: 'border-info/30 bg-info/10 text-info',
  },
  checked_in: {
    label: 'Hospedado',
    variant: 'outline',
    className: 'border-success/30 bg-success/10 text-success',
  },
  checked_out: {
    label: 'Check-out',
    variant: 'outline',
    className: 'border-border bg-muted/40 text-muted-foreground',
  },
  cancelled: {
    label: 'Cancelada',
    variant: 'outline',
    className: 'border-danger/30 bg-danger/10 text-danger',
  },
  no_show: {
    label: 'No-show',
    variant: 'outline',
    className: 'border-warning/30 bg-warning/10 text-warning',
  },
};

// -------------------------------------------------------
// Currency formatter
// -------------------------------------------------------

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// -------------------------------------------------------
// Arrival badge
// -------------------------------------------------------

function ArrivalBadge({ checkInDate }: { checkInDate: string }) {
  const date = new Date(`${checkInDate}T12:00:00`);
  if (isToday(date)) {
    return (
      <Badge variant="outline" className="text-[10px] border-status-arrivals/30 bg-status-arrivals/10 text-status-arrivals">
        Hoy
      </Badge>
    );
  }
  if (isTomorrow(date)) {
    return (
      <Badge variant="outline" className="text-[10px] border-status-occupancy/30 bg-status-occupancy/10 text-status-occupancy">
        Mañana
      </Badge>
    );
  }
  if (isPast(date)) {
    return (
      <Badge variant="outline" className="text-[10px] border-danger/30 bg-danger/10 text-danger">
        Pasada
      </Badge>
    );
  }
  return null;
}

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

  const filterStatus = searchParams.get('estado') ?? '';
  const filterDateFrom = searchParams.get('desde') ?? '';
  const filterDateTo = searchParams.get('hasta') ?? '';

  const [createOpen, setCreateOpen] = useState(false);
  const [arrivalModalOpen, setArrivalModalOpen] = useState(false);
  const [selectedStayId, setSelectedStayId] = useState<string | null>(null);

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

  // Apply filters
  let filtered = reservations;
  if (filterStatus) {
    filtered = filtered.filter((r) => r.status === filterStatus);
  }
  if (filterDateFrom) {
    filtered = filtered.filter((r) => r.check_in_date >= filterDateFrom);
  }
  if (filterDateTo) {
    filtered = filtered.filter((r) => r.check_in_date <= filterDateTo);
  }

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
      render: (stay) => (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">
            {format(new Date(`${stay.check_in_date}T12:00:00`), 'd MMM yyyy', { locale: es })}
          </span>
          <ArrivalBadge checkInDate={stay.check_in_date} />
        </div>
      ),
    },
    {
      key: 'check_out',
      header: 'Salida',
      priority: 2,
      render: (stay) => (
        <span className="text-muted-foreground">
          {format(new Date(`${stay.check_out_date}T12:00:00`), 'd MMM yyyy', { locale: es })}
        </span>
      ),
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
        const statusCfg = STATUS_CONFIG[stay.status];
        return (
          <Badge variant="outline" className={`text-[11px] ${statusCfg.className}`}>
            {statusCfg.label}
          </Badge>
        );
      },
    },
    {
      key: 'action',
      header: 'Acción',
      priority: 2,
      render: (stay) => {
        const checkInDate = new Date(`${stay.check_in_date}T12:00:00`);
        const isArrivalToday = isToday(checkInDate);
        const isArrivalPast = isPast(checkInDate) && !isToday(checkInDate);
        const isArrivalFuture = isFuture(checkInDate) && !isToday(checkInDate);
        const isReserved = stay.status === 'reserved';
        if (!isReserved) return null;
        return (
          <div className="flex items-center justify-end gap-1">
            {isArrivalToday && (
              <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => openArrivalModal(stay.id)}>
                <LogIn className="h-3.5 w-3.5" />
                Confirmar llegada
              </Button>
            )}
            {isArrivalPast && (
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => openArrivalModal(stay.id)}>
                <LogIn className="h-3.5 w-3.5" />
                Confirmar llegada
              </Button>
            )}
            {isArrivalFuture && (
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
            )}
          </div>
        );
      },
    },
  ];

  function renderCard(stay: StayViewRow) {
    const statusCfg = STATUS_CONFIG[stay.status];
    const checkInDate = new Date(`${stay.check_in_date}T12:00:00`);
    const isArrivalToday = isToday(checkInDate);
    const isArrivalPast = isPast(checkInDate) && !isToday(checkInDate);
    const isReserved = stay.status === 'reserved';
    return (
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/hotel/reservas/${stay.id}`} className="font-mono text-xs text-muted-foreground hover:underline">
            {stay.code}
          </Link>
          <Badge variant="outline" className={`text-[11px] ${statusCfg.className}`}>
            {statusCfg.label}
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
              <ArrivalBadge checkInDate={stay.check_in_date} />
            </div>
          </div>
          <div>
            <p className="font-medium text-foreground">Salida</p>
            {format(new Date(`${stay.check_out_date}T12:00:00`), 'd MMM yyyy', { locale: es })}
          </div>
        </div>
        {isReserved && (isArrivalToday || isArrivalPast) && (
          <Button className="w-full gap-1.5" size="sm" onClick={() => openArrivalModal(stay.id)}>
            <LogIn className="h-3.5 w-3.5" />
            Confirmar llegada
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
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
      </div>

      {/* Filters */}
      <div className="border-b px-6 py-2.5">
        <FilterBar activeCount={activeFilterCount}>
          <Select value={filterStatus} onValueChange={(v) => updateParam('estado', v || null)}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {(Object.entries(STATUS_CONFIG) as [StayStatus, (typeof STATUS_CONFIG)[StayStatus]][]).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>
                  {cfg.label}
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
      <div className="flex-1 overflow-auto px-6 py-4">
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
