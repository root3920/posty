'use client';

import { useState, useMemo } from 'react';
import { startOfWeek, addDays, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { todayInTimezone, parseDateOnly } from '@/lib/dates';
import type { EventBookingView, EventVenue } from '@/hooks/use-events';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface EventCalendarProps {
  bookings: EventBookingView[];
  venues: EventVenue[];
  onBookingClick: (bookingId: string) => void;
  timezone: string;
}

// -------------------------------------------------------
// Status color classes
// -------------------------------------------------------

const BOOKING_COLOR: Record<string, string> = {
  confirmed:
    'bg-emerald-50 border-l-2 border-emerald-500 dark:bg-emerald-950/30',
  pending_deposit:
    'bg-amber-50 border-l-2 border-amber-500 dark:bg-amber-950/30',
  finished: 'bg-muted/50 border-l-2 border-border',
};

// -------------------------------------------------------
// EventCalendar
// -------------------------------------------------------

export function EventCalendar({
  bookings,
  venues,
  onBookingClick,
  timezone,
}: EventCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const todayStr = todayInTimezone(timezone);
  const todayDate = parseDateOnly(todayStr);

  // Derive the week's start date (Monday) from weekOffset
  const weekStart = useMemo(() => {
    const base = startOfWeek(todayDate, { weekStartsOn: 1 });
    return addDays(base, weekOffset * 7);
  }, [weekOffset, todayStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const weekEnd = addDays(weekStart, 6);

  // Build array of 7 days
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Range text e.g. "28 sep – 4 oct 2026"
  const rangeText = useMemo(() => {
    const start = format(weekStart, "d MMM", { locale: es });
    const end = format(weekEnd, "d MMM yyyy", { locale: es });
    return `${start} – ${end}`;
  }, [weekStart, weekEnd]);

  // Pre-index bookings by "venueId|date"
  const bookingIndex = useMemo(() => {
    const idx: Record<string, EventBookingView[]> = {};
    for (const b of bookings) {
      if (b.status === 'cancelled') continue;
      const key = `${b.venue_id}|${b.event_date}`;
      (idx[key] ??= []).push(b);
    }
    // Sort each slot by start_time
    for (const key of Object.keys(idx)) {
      idx[key].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return idx;
  }, [bookings]);

  return (
    <div className="space-y-3">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekOffset((o) => o - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">Anterior</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekOffset(0)}
          disabled={weekOffset === 0}
        >
          Hoy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekOffset((o) => o + 1)}
        >
          <span className="mr-1 hidden sm:inline">Siguiente</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-2 text-sm text-muted-foreground capitalize">
          {rangeText}
        </span>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-xl border">
        <div
          className="min-w-[640px]"
          style={{
            display: 'grid',
            gridTemplateColumns: '160px repeat(7, 1fr)',
          }}
        >
          {/* Header row */}
          {/* Top-left corner */}
          <div className="sticky left-0 z-20 border-b border-r bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            Espacio
          </div>

          {/* Day headers */}
          {days.map((day) => {
            const isToday = isSameDay(day, todayDate);
            return (
              <div
                key={day.toISOString()}
                className={`border-b border-r px-2 py-2 text-center text-xs font-medium last:border-r-0 ${
                  isToday
                    ? 'bg-primary/5 text-primary'
                    : 'bg-muted/40 text-muted-foreground'
                }`}
              >
                <span className="capitalize">
                  {format(day, 'EEE d', { locale: es })}
                </span>
              </div>
            );
          })}

          {/* Venue rows */}
          {venues.map((venue, vIdx) => {
            const isLastVenue = vIdx === venues.length - 1;
            return (
              <>
                {/* Venue name cell */}
                <div
                  key={`name-${venue.id}`}
                  className={`sticky left-0 z-10 border-r bg-card px-3 py-2 ${
                    isLastVenue ? '' : 'border-b'
                  }`}
                >
                  <p className="text-sm font-medium leading-tight">{venue.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Máx. {venue.max_capacity}p
                  </p>
                </div>

                {/* Day cells for this venue */}
                {days.map((day, dIdx) => {
                  const isToday = isSameDay(day, todayDate);
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const key = `${venue.id}|${dateStr}`;
                  const dayBookings = bookingIndex[key] ?? [];
                  const isLastDay = dIdx === 6;

                  return (
                    <div
                      key={`${venue.id}-${dateStr}`}
                      className={`relative min-h-[72px] p-1 ${isLastDay ? '' : 'border-r'} ${
                        isLastVenue ? '' : 'border-b'
                      } ${isToday ? 'bg-primary/5' : 'bg-card'}`}
                    >
                      {dayBookings.map((b) => {
                        const colorClass =
                          BOOKING_COLOR[b.status] ??
                          'bg-muted/50 border-l-2 border-border';
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => onBookingClick(b.id)}
                            className={`mb-1 w-full rounded px-1.5 py-1 text-left text-[11px] leading-tight transition-opacity hover:opacity-80 ${colorClass}`}
                          >
                            <p className="tabular-nums font-medium">
                              {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                            </p>
                            <p className="truncate text-muted-foreground">
                              {b.client_name}
                            </p>
                            <p className="text-muted-foreground">
                              {b.guest_count}p
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            );
          })}

          {/* Empty state if no venues */}
          {venues.length === 0 && (
            <div
              className="col-span-8 py-12 text-center text-sm text-muted-foreground"
            >
              No hay espacios activos configurados.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
