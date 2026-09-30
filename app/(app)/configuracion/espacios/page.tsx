'use client';

import { useState } from 'react';

import { EspaciosTab } from '@/components/events/espacios-tab';
import { VenueDialog } from '@/components/events/venue-dialog';
import { useEventBookings, type EventVenue } from '@/hooks/use-events';
import { useOrganization } from '@/hooks/use-organization';

export default function ConfigEspaciosPage() {
  const { currency, locale } = useOrganization();
  const { data: bookings = [] } = useEventBookings();

  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<EventVenue | undefined>(undefined);

  function openEditVenue(venue: EventVenue) {
    setEditingVenue(venue);
    setVenueDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Espacios para eventos</h1>
        <p className="text-muted-foreground text-sm">
          Administra los espacios disponibles para alquilar
        </p>
      </div>

      <EspaciosTab
        bookings={bookings}
        currency={currency}
        locale={locale}
        onNewVenue={() => {
          setEditingVenue(undefined);
          setVenueDialogOpen(true);
        }}
        onEditVenue={openEditVenue}
        onNewBooking={() => {
          // From config, just open the venues page
          window.location.href = '/eventos?tab=espacios';
        }}
      />

      <VenueDialog
        open={venueDialogOpen}
        onOpenChange={setVenueDialogOpen}
        venue={editingVenue}
      />
    </div>
  );
}
