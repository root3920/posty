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
import { EntitySelect } from '@/components/shared/entity-select';

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
                icon={<BedDouble className="h-5 w-5 text-status-available" />}
                label="Disponibles"
                value={kpis.availableRooms}
                color="text-status-available"
              />
              <KpiCard
                icon={<Users className="h-5 w-5 text-status-occupied" />}
                label="Ocupadas"
                value={kpis.occupiedRooms}
                color="text-status-occupied"
              />
              <KpiCard
                icon={<Sparkles className="h-5 w-5 text-status-dirty" />}
                label="Sucias / limpieza"
                value={kpis.dirtyRooms}
                color="text-status-dirty"
              />
              <KpiCard
                icon={<AlertTriangle className="h-5 w-5 text-status-out" />}
                label="Fuera de servicio"
                value={kpis.outOfServiceRooms}
                color="text-status-out"
              />
              <KpiCard
                icon={<TrendingUp className="h-5 w-5 text-status-occupancy" />}
                label="Ocupación"
                value={`${kpis.occupancyPct}%`}
                subLabel={`${kpis.occupiedRooms} / ${kpis.totalRooms} hab.`}
                color="text-status-occupancy"
              />
              <KpiCard
                icon={<ArrowDownToLine className="h-5 w-5 text-status-arrivals" />}
                label="Llegadas hoy"
                value={kpis.arrivalsToday}
                color="text-status-arrivals"
              />
              <KpiCard
                icon={<ArrowUpFromLine className="h-5 w-5 text-status-departures" />}
                label="Salidas hoy"
                value={kpis.departuresToday}
                color="text-status-departures"
              />
              <KpiCard
                icon={<Users className="h-5 w-5 text-status-guests" />}
                label="Huéspedes en casa"
                value={kpis.guestsInHouse}
                color="text-status-guests"
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

              <EntitySelect
                options={roomStatuses.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
                value={filterStatus ?? null}
                onChange={(v) => updateParam('estado', v)}
                placeholder="Estado"
                allowClear
                clearLabel="Todos los estados"
                size="sm"
                triggerClassName="w-36"
              />

              <EntitySelect
                options={roomTypes.map((t) => ({ value: t.id, label: t.name }))}
                value={filterType ?? null}
                onChange={(v) => updateParam('tipo', v)}
                placeholder="Tipo"
                allowClear
                clearLabel="Todos los tipos"
                size="sm"
                triggerClassName="w-36"
              />

              {floors.length > 0 && (
                <EntitySelect
                  options={floors.map((f) => ({ value: f, label: `Piso ${f}` }))}
                  value={filterFloor ?? null}
                  onChange={(v) => updateParam('piso', v)}
                  placeholder="Piso"
                  allowClear
                  clearLabel="Todos"
                  size="sm"
                  triggerClassName="w-28"
                />
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
