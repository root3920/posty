'use client';

import { useState } from 'react';
import { differenceInDays, isToday } from 'date-fns';
import { LogIn } from 'lucide-react';
import type { RoomWithDetails } from '@/hooks/use-hotel';
import { ConfirmArrivalModal } from '@/components/hotel/confirm-arrival-modal';

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface RoomMapProps {
  rooms: RoomWithDetails[];
  filterStatus?: string;
  filterType?: string;
  filterFloor?: string;
  onRoomClick: (room: RoomWithDetails) => void;
}

// -------------------------------------------------------
// Room card
// -------------------------------------------------------

interface RoomCardProps {
  room: RoomWithDetails;
  onClick: () => void;
  onConfirmArrival: (stayId: string, e: React.MouseEvent) => void;
}

function RoomCard({ room, onClick, onConfirmArrival }: RoomCardProps) {
  const status = room.room_status;
  const stay = room.current_stay;
  const today = new Date();

  const nightsRemaining = stay
    ? differenceInDays(new Date(`${stay.check_out_date}T12:00:00`), today)
    : 0;

  const bgColor = status.color ?? '#e5e7eb';
  const isOccupied = !!stay;
  const isDark = isColorDark(bgColor);
  const textColor = isDark ? '#ffffff' : '#1f2937';

  // Check if this room has a reserved stay with today's check-in
  const reservedStayToday = room.active_stays.find(
    (s) =>
      s.status === 'reserved' &&
      s.check_in_date &&
      isToday(new Date(`${s.check_in_date}T12:00:00`)),
  );

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        title={`Habitación ${room.number} — ${status.name}`}
        className="flex flex-col rounded-lg border-2 p-2.5 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 w-full"
        style={{
          backgroundColor: bgColor,
          borderColor: `${bgColor}cc`,
          color: textColor,
          minWidth: '100px',
          minHeight: '80px',
        }}
      >
        {/* Room number */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-base font-bold leading-none">{room.number}</span>
          <span
            className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-90"
            style={{ backgroundColor: `${bgColor}bb`, color: textColor }}
          >
            {room.room_type.name.slice(0, 3).toUpperCase()}
          </span>
        </div>

        {/* Status */}
        <span className="mt-1 text-[10px] opacity-80">{status.name}</span>

        {/* Guest info if occupied */}
        {isOccupied && stay && (
          <div className="mt-1.5 flex-1">
            <p className="truncate text-[11px] font-medium leading-tight">
              {stay.guest.last_name}, {stay.guest.first_name.slice(0, 1)}.
            </p>
            <p className="mt-0.5 text-[10px] opacity-75">
              {nightsRemaining > 0 ? `${nightsRemaining} noche(s)` : 'Sale hoy'}
            </p>
          </div>
        )}

        {/* Reserved today indicator */}
        {reservedStayToday && !isOccupied && (
          <p className="mt-1.5 text-[10px] font-medium opacity-90">Llega hoy</p>
        )}
      </button>

      {/* Confirm arrival overlay button for reserved rooms arriving today */}
      {reservedStayToday && !isOccupied && (
        <button
          onClick={(e) => onConfirmArrival(reservedStayToday.id, e)}
          className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-gray-800 shadow hover:bg-white transition-colors"
          title="Confirmar llegada"
        >
          <LogIn className="h-2.5 w-2.5" />
          Confirmar
        </button>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Color utility
// -------------------------------------------------------

function isColorDark(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

// -------------------------------------------------------
// Room map
// -------------------------------------------------------

export function RoomMap({ rooms, filterStatus, filterType, filterFloor, onRoomClick }: RoomMapProps) {
  const [arrivalModalOpen, setArrivalModalOpen] = useState(false);
  const [selectedStayId, setSelectedStayId] = useState<string | null>(null);

  function handleConfirmArrival(stayId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedStayId(stayId);
    setArrivalModalOpen(true);
  }

  // Apply filters
  let filtered = rooms;
  if (filterStatus) {
    filtered = filtered.filter((r) => r.status_id === filterStatus);
  }
  if (filterType) {
    filtered = filtered.filter((r) => r.room_type_id === filterType);
  }
  if (filterFloor) {
    filtered = filtered.filter((r) => r.floor === filterFloor);
  }

  // Group by floor
  const floorMap = new Map<string, RoomWithDetails[]>();
  for (const room of filtered) {
    const floor = room.floor ?? 'Sin piso';
    if (!floorMap.has(floor)) floorMap.set(floor, []);
    floorMap.get(floor)!.push(room);
  }

  const floors = Array.from(floorMap.keys()).sort((a, b) => {
    const na = parseInt(a);
    const nb = parseInt(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  if (filtered.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No hay habitaciones que coincidan con los filtros.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {floors.map((floor) => (
          <div key={floor}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {floor === 'Sin piso' ? floor : `Piso ${floor}`}
            </h3>
            <div className="flex flex-wrap gap-2">
              {(floorMap.get(floor) ?? []).map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onClick={() => onRoomClick(room)}
                  onConfirmArrival={handleConfirmArrival}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <ConfirmArrivalModal
        open={arrivalModalOpen}
        onOpenChange={setArrivalModalOpen}
        stayId={selectedStayId}
      />
    </>
  );
}
