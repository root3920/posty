'use client';

import { useMemo } from 'react';
import { CalendarDays, Calendar, Users, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { PricingTypeBadge } from '@/components/events/event-status-badge';
import {
  useAllEventVenues,
  useUpdateVenue,
  type EventBookingView,
  type EventVenue,
} from '@/hooks/use-events';
import { formatCurrency } from '@/lib/format';

const PRICING_UNIT_LABEL: Record<string, string> = {
  per_hour: '/hora',
  per_person: '/persona',
  flat_rate: '',
};

interface EspaciosTabProps {
  bookings: EventBookingView[];
  currency: string;
  locale: string;
  onNewVenue: () => void;
  onEditVenue: (venue: EventVenue) => void;
  onNewBooking: (venueId: string) => void;
}

export function EspaciosTab({
  bookings,
  currency,
  locale,
  onNewVenue,
  onEditVenue,
  onNewBooking,
}: EspaciosTabProps) {
  const { data: allVenues = [], isLoading } = useAllEventVenues();
  const updateVenue = useUpdateVenue();

  // Count bookings this week per venue
  const bookingsThisWeek = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startStr = startOfWeek.toISOString().slice(0, 10);
    const endStr = endOfWeek.toISOString().slice(0, 10);

    const counts: Record<string, number> = {};
    for (const b of bookings) {
      if (b.event_date >= startStr && b.event_date <= endStr && b.status !== 'cancelled') {
        counts[b.venue_id] = (counts[b.venue_id] ?? 0) + 1;
      }
    }
    return counts;
  }, [bookings]);

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

          <div className="flex items-end gap-4">
            <div>
              <p className="text-2xl font-semibold font-heading tabular-nums leading-none">
                {formatCurrency(venue.price, currency, locale)}
                <span className="ml-0.5 text-sm font-normal text-muted-foreground">
                  {PRICING_UNIT_LABEL[venue.pricing_type] ?? ''}
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
