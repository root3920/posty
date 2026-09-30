'use client';

import { Badge } from '@/components/ui/badge';
import type { Enums } from '@/types/database';

// -------------------------------------------------------
// Config maps
// -------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  pending_deposit: {
    label: 'Pendiente depósito',
    variant: 'outline',
    className: 'border-amber-500 text-amber-600',
  },
  confirmed: {
    label: 'Confirmada',
    variant: 'default',
    className: 'bg-emerald-600 hover:bg-emerald-700',
  },
  finished: {
    label: 'Finalizada',
    variant: 'secondary',
  },
  cancelled: {
    label: 'Cancelada',
    variant: 'destructive',
  },
};

const DEPOSIT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'text-amber-600' },
  received: { label: 'Recibido', color: 'text-emerald-600' },
  returned: { label: 'Devuelto', color: 'text-violet-600' },
  retained: { label: 'Retenido', color: 'text-red-600' },
};

export const PRICING_TYPE_LABELS: Record<string, string> = {
  per_hour: 'Por hora',
  per_person: 'Por persona',
  flat_rate: 'Tarifa fija',
};

// -------------------------------------------------------
// EventBookingStatusBadge
// -------------------------------------------------------

interface EventBookingStatusBadgeProps {
  status: Enums<'event_booking_status'> | string;
}

export function EventBookingStatusBadge({ status }: EventBookingStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'secondary' as const };

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

// -------------------------------------------------------
// DepositStatusBadge
// -------------------------------------------------------

interface DepositStatusBadgeProps {
  status: Enums<'event_deposit_status'> | string;
}

export function DepositStatusBadge({ status }: DepositStatusBadgeProps) {
  const config = DEPOSIT_STATUS_CONFIG[status] ?? { label: status, color: 'text-muted-foreground' };

  return (
    <span className={`text-sm font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

// -------------------------------------------------------
// PricingTypeBadge
// -------------------------------------------------------

interface PricingTypeBadgeProps {
  pricingType: string;
}

export function PricingTypeBadge({ pricingType }: PricingTypeBadgeProps) {
  const label = PRICING_TYPE_LABELS[pricingType] ?? pricingType;
  return (
    <Badge variant="outline" className="text-xs">
      {label}
    </Badge>
  );
}
