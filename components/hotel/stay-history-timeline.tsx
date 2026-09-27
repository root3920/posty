'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { StatusHistoryRow } from '@/hooks/use-hotel';

const STATUS_LABELS: Record<string, string> = {
  reserved: 'Reservado',
  checked_in: 'Hospedado',
  checked_out: 'Check-out',
  cancelled: 'Cancelado',
  no_show: 'No-show',
  pending_payment: 'Pago pendiente',
};

const STATUS_COLORS: Record<string, string> = {
  reserved: 'bg-info',
  checked_in: 'bg-emerald-500',
  checked_out: 'bg-muted-foreground',
  cancelled: 'bg-destructive',
  no_show: 'bg-warning',
  pending_payment: 'bg-warning',
};

interface StayHistoryTimelineProps {
  history: StatusHistoryRow[];
}

export function StayHistoryTimeline({ history }: StayHistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sin historial de estados.
      </p>
    );
  }

  return (
    <div className="relative space-y-0 pl-6">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />

      {history.map((entry, i) => {
        const label = STATUS_LABELS[entry.new_status] ?? entry.new_status;
        const dotColor = STATUS_COLORS[entry.new_status] ?? 'bg-muted-foreground';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const changedByName = (entry.changed_by_profile as any)?.full_name;

        return (
          <div key={entry.id} className="relative flex items-start gap-3 pb-4">
            {/* Dot */}
            <div className={`absolute left-[-15px] top-1.5 h-3 w-3 rounded-full ${dotColor} ring-2 ring-background`} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{label}</span>
                {entry.old_status && (
                  <span className="text-xs text-muted-foreground">
                    (antes: {STATUS_LABELS[entry.old_status] ?? entry.old_status})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>
                  {format(new Date(entry.changed_at), "d MMM yyyy · HH:mm", { locale: es })}
                </span>
                {changedByName && (
                  <>
                    <span>·</span>
                    <span>{changedByName}</span>
                  </>
                )}
              </div>
              {entry.note && (
                <p className="text-xs text-muted-foreground mt-1">{entry.note}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
