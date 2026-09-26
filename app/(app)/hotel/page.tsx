'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BedDouble,
  Users,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useRooms, useHotelKPIs, useRoomStatuses, useRoomTypes } from '@/hooks/use-hotel';
import { RoomMap } from '@/components/hotel/room-map';
import { RoomDetailDrawer } from '@/components/hotel/room-detail-drawer';
import { OccupancyTable } from '@/components/hotel/occupancy-table';
import { CheckInForm } from '@/components/hotel/check-in-form';
import type { RoomWithDetails } from '@/hooks/use-hotel';

// -------------------------------------------------------
// KPI card
// -------------------------------------------------------

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subLabel?: string;
  color?: string;
}

function KpiCard({ icon, label, value, subLabel, color = 'text-foreground' }: KpiCardProps) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold leading-tight ${color}`}>{value}</p>
          {subLabel && <p className="text-[11px] text-muted-foreground">{subLabel}</p>}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Main content
// -------------------------------------------------------

function HotelContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filterStatus = searchParams.get('estado') ?? undefined;
  const filterType = searchParams.get('tipo') ?? undefined;
  const filterFloor = searchParams.get('piso') ?? undefined;
  const activeTab = (searchParams.get('vista') ?? 'mapa') as 'mapa' | 'lista';

  const [selectedRoom, setSelectedRoom] = useState<RoomWithDetails | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);

  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  const { data: kpis, isLoading: kpisLoading } = useHotelKPIs();
  const { data: roomStatuses = [] } = useRoomStatuses();
  const { data: roomTypes = [] } = useRoomTypes();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleRoomClick(room: RoomWithDetails) {
    setSelectedRoom(room);
    setDrawerOpen(true);
  }

  const now = new Date();

  // Unique floors for filter
  const floors = Array.from(
    new Set(rooms.map((r) => r.floor).filter(Boolean) as string[]),
  ).sort((a, b) => {
    const na = parseInt(a);
    const nb = parseInt(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  return (
    <div className="flex h-full flex-col">
      {/* ============================= */}
      {/* Header */}
      {/* ============================= */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hotel</h1>
            <p className="mt-0.5 text-sm text-muted-foreground capitalize">
              {format(now, "EEEE, d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/hotel/reservas')}>
              Reservas
            </Button>
            <Button onClick={() => setCheckInOpen(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Nuevo check-in
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
        {/* ============================= */}
        {/* KPIs */}
        {/* ============================= */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {kpisLoading ? (
            [...Array(8)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : kpis ? (
            <>
              <KpiCard
                icon={<BedDouble className="h-5 w-5 text-green-600" />}
                label="Disponibles"
                value={kpis.availableRooms}
                color="text-green-600"
              />
              <KpiCard
                icon={<Users className="h-5 w-5 text-blue-600" />}
                label="Ocupadas"
                value={kpis.occupiedRooms}
                color="text-blue-600"
              />
              <KpiCard
                icon={<Sparkles className="h-5 w-5 text-amber-600" />}
                label="Sucias / limpieza"
                value={kpis.dirtyRooms}
                color="text-amber-600"
              />
              <KpiCard
                icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
                label="Fuera de servicio"
                value={kpis.outOfServiceRooms}
                color="text-red-600"
              />
              <KpiCard
                icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
                label="Ocupación"
                value={`${kpis.occupancyPct}%`}
                subLabel={`${kpis.occupiedRooms} / ${kpis.totalRooms} hab.`}
                color="text-indigo-600"
              />
              <KpiCard
                icon={<ArrowDownToLine className="h-5 w-5 text-teal-600" />}
                label="Llegadas hoy"
                value={kpis.arrivalsToday}
                color="text-teal-600"
              />
              <KpiCard
                icon={<ArrowUpFromLine className="h-5 w-5 text-orange-600" />}
                label="Salidas hoy"
                value={kpis.departuresToday}
                color="text-orange-600"
              />
              <KpiCard
                icon={<Users className="h-5 w-5 text-purple-600" />}
                label="Huéspedes en casa"
                value={kpis.guestsInHouse}
                color="text-purple-600"
              />
            </>
          ) : null}
        </div>

        {/* ============================= */}
        {/* View tabs */}
        {/* ============================= */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            {(['mapa', 'lista'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => updateParam('vista', tab)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab === 'mapa' ? 'Mapa de habitaciones' : 'Ocupación actual'}
              </button>
            ))}
          </div>

          {/* Filters (only for map view) */}
          {activeTab === 'mapa' && (
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />

              <Select
                value={filterStatus ?? ''}
                onValueChange={(v) => updateParam('estado', v || null)}
              >
                <SelectTrigger className="h-7 w-36 text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los estados</SelectItem>
                  {roomStatuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filterType ?? ''}
                onValueChange={(v) => updateParam('tipo', v || null)}
              >
                <SelectTrigger className="h-7 w-36 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los tipos</SelectItem>
                  {roomTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {floors.length > 0 && (
                <Select
                  value={filterFloor ?? ''}
                  onValueChange={(v) => updateParam('piso', v || null)}
                >
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue placeholder="Piso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {floors.map((f) => (
                      <SelectItem key={f} value={f}>
                        Piso {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        {/* ============================= */}
        {/* Content */}
        {/* ============================= */}
        {activeTab === 'mapa' ? (
          roomsLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : (
            <RoomMap
              rooms={rooms}
              filterStatus={filterStatus}
              filterType={filterType}
              filterFloor={filterFloor}
              onRoomClick={handleRoomClick}
            />
          )
        ) : (
          <OccupancyTable rooms={rooms} isLoading={roomsLoading} />
        )}
      </div>

      {/* ============================= */}
      {/* Room detail drawer */}
      {/* ============================= */}
      <RoomDetailDrawer
        room={selectedRoom}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      {/* Check-in form */}
      <CheckInForm open={checkInOpen} onOpenChange={setCheckInOpen} mode="checkin" />
    </div>
  );
}

// -------------------------------------------------------
// Page export (Suspense wrapper for useSearchParams)
// -------------------------------------------------------

export default function HotelPage() {
  return (
    <Suspense>
      <HotelContent />
    </Suspense>
  );
}
