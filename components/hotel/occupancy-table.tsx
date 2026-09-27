'use client';

import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { RoomWithDetails } from '@/hooks/use-hotel';

// -------------------------------------------------------
// Currency formatter
// -------------------------------------------------------

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface OccupancyTableProps {
  rooms: RoomWithDetails[];
  isLoading?: boolean;
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function OccupancyTable({ rooms, isLoading }: OccupancyTableProps) {
  const occupied = rooms.filter((r) => !!r.current_stay);

  function exportCsv() {
    const headers = [
      'Habitación',
      'Tipo',
      'Huésped',
      'Documento',
      'Teléfono',
      'Email',
      'Entrada',
      'Salida',
      'Noches totales',
      'Tarifa/noche',
    ];

    const rows = occupied.map((r) => {
      const stay = r.current_stay!;
      const nights = differenceInDays(
        new Date(`${stay.check_out_date}T12:00:00`),
        new Date(`${stay.check_in_date}T12:00:00`),
      );
      return [
        r.number,
        r.room_type.name,
        `${stay.guest.first_name} ${stay.guest.last_name}`,
        stay.guest.document_number ?? '',
        stay.guest.phone ?? '',
        stay.guest.email ?? '',
        stay.check_in_date,
        stay.check_out_date,
        String(nights),
        String(stay.rate_per_night),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ocupacion_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {occupied.length} habitación(es) ocupada(s)
        </p>
        {occupied.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        )}
      </div>

      {occupied.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No hay habitaciones ocupadas en este momento.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left">Hab.</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">Tipo</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">Huésped</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">Documento</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">Teléfono</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">Email</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">Entrada</th>
                <th className="whitespace-nowrap px-4 py-3 text-left">Salida</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Noches</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Tarifa</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {occupied.map((room) => {
                const stay = room.current_stay!;
                const nights = differenceInDays(
                  new Date(`${stay.check_out_date}T12:00:00`),
                  new Date(`${stay.check_in_date}T12:00:00`),
                );
                const nightsLeft = differenceInDays(
                  new Date(`${stay.check_out_date}T12:00:00`),
                  new Date(),
                );

                return (
                  <tr key={room.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold">{room.number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{room.room_type.name}</td>
                    <td className="px-4 py-3 font-medium">
                      {stay.guest.first_name} {stay.guest.last_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {stay.guest.document_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {stay.guest.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {stay.guest.email ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {format(new Date(`${stay.check_in_date}T12:00:00`), 'd MMM yyyy', {
                        locale: es,
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={
                          nightsLeft <= 0
                            ? 'font-semibold text-danger'
                            : nightsLeft === 1
                            ? 'font-semibold text-warning'
                            : 'text-muted-foreground'
                        }
                      >
                        {format(new Date(`${stay.check_out_date}T12:00:00`), 'd MMM yyyy', {
                          locale: es,
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{nights}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                      {copFormatter.format(stay.rate_per_night)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
