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
import { PageHeader } from '@/components/shared/page-header';
import { KpiGrid } from '@/components/shared/kpi-grid';
import { KpiCard, KpiCardSkeleton } from '@/components/shared/kpi-card';
import { formatPercent } from '@/lib/format';

import { useRooms, useHotelKPIs, useRoomStatuses, useRoomTypes } from '@/hooks/use-hotel';
import { RoomMap } from '@/components/hotel/room-map';
import { TourTrigger } from '@/components/onboarding/tour-trigger';
import { RoomDetailDrawer } from '@/components/hotel/room-detail-drawer';
import { OccupancyTable } from '@/components/hotel/occupancy-table';
import { CheckInForm } from '@/components/hotel/check-in-form';
import type { RoomWithDetails } from '@/hooks/use-hotel';

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
    <div className="space-y-6">
      <TourTrigger module="hotel" />
      {/* ============================= */}
      {/* Header */}
      {/* ============================= */}
      <PageHeader
        title="Hotel"
        description={format(now, "EEEE, d 'de' MMMM yyyy", { locale: es })}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button data-tour="hotel-reservas" variant="outline" size="sm" onClick={() => router.push('/hotel/reservas')}>
              Reservas
            </Button>
            <Button data-tour="hotel-checkin" onClick={() => setCheckInOpen(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Nuevo check-in
            </Button>
          </div>
        }
      />
        {/* ============================= */}
        {/* KPIs */}
        {/* ============================= */}
        <KpiGrid>
          {kpisLoading ? (
            [...Array(8)].map((_, i) => <KpiCardSkeleton key={i} />)
          ) : kpis ? (
            <>
              <KpiCard
                icon={<BedDouble className="h-5 w-5" />}
                label="Disponibles"
                value={kpis.availableRooms}
                subLabel={`de ${kpis.totalRooms} habitaciones`}
              />
              <KpiCard
                icon={<Users className="h-5 w-5" />}
                label="Ocupadas"
                value={kpis.occupiedRooms}
              />
              <KpiCard
                icon={<Sparkles className="h-5 w-5" />}
                label="Sucias / limpieza"
                value={kpis.dirtyRooms}
              />
              <KpiCard
                icon={<AlertTriangle className="h-5 w-5" />}
                label="Fuera de servicio"
                value={kpis.outOfServiceRooms}
              />
              <KpiCard
                icon={<TrendingUp className="h-5 w-5" />}
                label="Ocupación"
                value={kpis.occupancyPct}
                formatValue={(n) => formatPercent(n)}
                subLabel={`${kpis.occupiedRooms} / ${kpis.totalRooms} hab.`}
              />
              <KpiCard
                icon={<ArrowDownToLine className="h-5 w-5" />}
                label="Llegadas hoy"
                value={kpis.arrivalsToday}
              />
              <KpiCard
                icon={<ArrowUpFromLine className="h-5 w-5" />}
                label="Salidas hoy"
                value={kpis.departuresToday}
              />
              <KpiCard
                icon={<Users className="h-5 w-5" />}
                label="Huéspedes en casa"
                value={kpis.guestsInHouse}
              />
            </>
          ) : null}
        </KpiGrid>

        {/* ============================= */}
        {/* View tabs + Filters */}
        {/* ============================= */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1">
            {(['mapa', 'lista'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => updateParam('vista', tab)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab === 'mapa' ? 'Mapa' : 'Ocupación'}
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
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : (
            <div data-tour="hotel-rooms">
              <RoomMap
                rooms={rooms}
                filterStatus={filterStatus}
                filterType={filterType}
                filterFloor={filterFloor}
                onRoomClick={handleRoomClick}
              />
            </div>
          )
        ) : (
          <OccupancyTable rooms={rooms} isLoading={roomsLoading} />
        )}

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
