'use client';

import { Badge } from '@/components/ui/badge';
import type { Enums } from '@/types/database';

const STATUS_CONFIG: Record<
  Enums<'contract_status'>,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }
> = {
  draft: { label: 'Borrador', variant: 'secondary' },
  sent_for_signature: { label: 'Enviado para firma', variant: 'outline', className: 'border-blue-500 text-blue-600' },
  signed: { label: 'Firmado', variant: 'outline', className: 'border-emerald-500 text-emerald-600' },
  active: { label: 'Activo', variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-700' },
  expiring_soon: { label: 'Por vencer', variant: 'default', className: 'bg-amber-500 hover:bg-amber-600' },
  finished: { label: 'Finalizado', variant: 'secondary' },
  terminated_early: { label: 'Terminado', variant: 'destructive' },
  renewed: { label: 'Renovado', variant: 'outline', className: 'border-blue-500 text-blue-600' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

interface ContractStatusBadgeProps {
  status: Enums<'contract_status'>;
}

export function ContractStatusBadge({ status }: ContractStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'secondary' as const };
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

// Installment status labels for tables
const INSTALLMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'text-muted-foreground' },
  paid: { label: 'Pagada', color: 'text-emerald-600' },
  partial: { label: 'Parcial', color: 'text-amber-600' },
  overdue: { label: 'Vencida', color: 'text-red-600' },
  voided: { label: 'Anulada', color: 'text-muted-foreground line-through' },
};

export function InstallmentStatusBadge({ status }: { status: string }) {
  const config = INSTALLMENT_STATUS[status] ?? { label: status, color: '' };
  return <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>;
}

// Human-readable labels
export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  sent_for_signature: 'Enviado para firma',
  signed: 'Firmado',
  active: 'Activo',
  expiring_soon: 'Por vencer',
  finished: 'Finalizado',
  terminated_early: 'Terminado',
  renewed: 'Renovado',
  cancelled: 'Cancelado',
};

export const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: 'Mensual',
  biweekly: 'Quincenal',
  weekly: 'Semanal',
};

export const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  partial: 'Parcial',
  returned: 'Devuelto',
  applied: 'Aplicado',
};

export const INCLUDED_SERVICES_OPTIONS = [
  'Wifi',
  'Limpieza',
  'Lavandería de lencería',
  'Servicios públicos',
  'Desayuno',
  'Parqueadero',
];
