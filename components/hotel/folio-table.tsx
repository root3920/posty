'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { StayDetail } from '@/hooks/use-hotel';

// -------------------------------------------------------
// Currency formatter
// -------------------------------------------------------

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatCOP(amount: number): string {
  return copFormatter.format(amount);
}

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface FolioTableProps {
  charges: StayDetail['folio_charges'];
  payments: StayDetail['payments'];
  balance: StayDetail['balance'];
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function FolioTable({ charges, payments, balance }: FolioTableProps) {
  const hasItems = charges.length > 0 || payments.length > 0;

  if (!hasItems) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
        <Receipt className="h-8 w-8 opacity-40" />
        <p className="text-sm">Sin cargos ni pagos registrados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Descripción</span>
        <span className="text-right">Cant.</span>
        <span className="text-right">Precio</span>
        <span className="text-right">Total</span>
      </div>

      {/* Charges */}
      {charges.map((charge) => (
        <div
          key={charge.id}
          className="grid grid-cols-[1fr_auto_auto_auto] items-start gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/50"
        >
          <div>
            <p className="font-medium leading-tight">{charge.description}</p>
            <p className="text-[11px] text-muted-foreground">
              {charge.revenue_center.name} &middot;{' '}
              {format(new Date(charge.posted_at), "d MMM, HH:mm", { locale: es })}
            </p>
          </div>
          <span className="text-right text-muted-foreground">{charge.quantity}</span>
          <span className="text-right text-muted-foreground">
            {formatCOP(charge.unit_price)}
          </span>
          <span className="text-right font-medium">{formatCOP(charge.total ?? 0)}</span>
        </div>
      ))}

      {/* Separator */}
      {charges.length > 0 && payments.length > 0 && (
        <div className="my-2 border-t" />
      )}

      {/* Payments */}
      {payments.map((payment) => (
        <div
          key={payment.id}
          className="grid grid-cols-[1fr_auto_auto_auto] items-start gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/50"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium leading-tight">Pago — {payment.method.name}</span>
              <Badge variant="outline" className="h-4 text-[9px] text-success border-success/30 bg-success/10">
                Pago
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {payment.reference && `Ref: ${payment.reference} · `}
              {format(new Date(payment.paid_at), "d MMM, HH:mm", { locale: es })}
            </p>
          </div>
          <span />
          <span />
          <span className="text-right font-medium text-success">
            -{formatCOP(payment.amount)}
          </span>
        </div>
      ))}

      {/* Balance summary */}
      <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Total cargos</span>
          <span>{formatCOP(balance.total_charges)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Total pagos</span>
          <span className="text-success">-{formatCOP(balance.total_payments)}</span>
        </div>
        <div className="mt-1.5 flex justify-between border-t pt-1.5 text-sm font-bold">
          <span>Saldo pendiente</span>
          <span
            className={
              balance.balance > 0
                ? 'text-danger'
                : balance.balance < 0
                ? 'text-success'
                : 'text-muted-foreground'
            }
          >
            {formatCOP(balance.balance)}
          </span>
        </div>
      </div>
    </div>
  );
}
