'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, CalendarDays } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

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

import { CheckInForm } from '@/components/hotel/check-in-form';
import { RoomBadge } from '@/components/shared/room-badge';
import { GuestName } from '@/components/shared/guest-name';
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
    label: 'In-house',
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

  const filterStatus = searchParams.get('estado') ?? '';
  const filterDateFrom = searchParams.get('desde') ?? '';
  const filterDateTo = searchParams.get('hasta') ?? '';

  const [createOpen, setCreateOpen] = useState(false);

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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reservas</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Próximas llegadas y estancias activas
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva reserva
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b px-6 py-2.5">
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
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Código</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Huésped</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Habitación</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Entrada</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Salida</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Noches</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Tarifa</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((stay) => {
                  const statusCfg = STATUS_CONFIG[stay.status];
                  return (
                    <tr key={stay.id} className="hover:bg-muted/30 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground">{stay.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <GuestName
                          firstName={stay.guest_first_name}
                          lastName={stay.guest_last_name}
                          documentNumber={stay.guest_document_number}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <RoomBadge
                          number={stay.room_number}
                          typeName={stay.room_type_name ?? undefined}
                          floor={stay.room_floor ?? undefined}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">
                            {format(
                              new Date(`${stay.check_in_date}T12:00:00`),
                              "d MMM yyyy",
                              { locale: es },
                            )}
                          </span>
                          <ArrivalBadge checkInDate={stay.check_in_date} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {format(
                          new Date(`${stay.check_out_date}T12:00:00`),
                          "d MMM yyyy",
                          { locale: es },
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{stay.nights}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                        {copFormatter.format(stay.rate_per_night)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-[11px] ${statusCfg.className}`}
                        >
                          {statusCfg.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create reservation dialog */}
      <CheckInForm open={createOpen} onOpenChange={setCreateOpen} mode="reservation" />
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
