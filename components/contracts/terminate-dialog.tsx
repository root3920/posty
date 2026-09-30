'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { useTerminateContract } from '@/hooks/use-contracts';
import { formatCurrency } from '@/lib/format';
import { useOrganization } from '@/hooks/use-organization';

interface TerminateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  contractCode: string;
  monthlyRate: number;
  depositPaid: number;
  onTerminated?: () => void;
}

export function TerminateDialog({
  open,
  onOpenChange,
  contractId,
  contractCode,
  monthlyRate,
  depositPaid,
  onTerminated,
}: TerminateDialogProps) {
  const { currency, locale } = useOrganization();
  const terminate = useTerminateContract();

  const [terminationDate, setTerminationDate] = useState('');
  const [reason, setReason] = useState('');
  const [penalty, setPenalty] = useState(0);

  // Simple preview calculation (real values come from the RPC response)
  const estimatedPending = monthlyRate;
  const depositToReturn = Math.max(0, depositPaid - penalty);
  const balance = depositToReturn - estimatedPending - penalty;

  const valid = !!terminationDate;

  function handleSubmit() {
    if (!valid) return;
    terminate.mutate(
      {
        contract_id: contractId,
        termination_date: terminationDate,
        reason: reason || undefined,
        penalty,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          reset();
          onTerminated?.();
        },
      },
    );
  }

  function reset() {
    setTerminationDate('');
    setReason('');
    setPenalty(0);
  }

  const footer = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={() => { onOpenChange(false); reset(); }}>
        Cancelar
      </Button>
      <Button
        type="button"
        variant="destructive"
        disabled={!valid || terminate.isPending}
        onClick={handleSubmit}
      >
        {terminate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Terminar contrato'}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Terminar contrato"
      description={`Contrato ${contractCode} — Esta acción no se puede deshacer`}
      footer={footer}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">Fecha de terminación *</Label>
          <Input
            type="date"
            value={terminationDate}
            onChange={(e) => setTerminationDate(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Penalidad</Label>
          <Input
            type="number"
            value={penalty || ''}
            onChange={(e) => setPenalty(Number(e.target.value))}
            min={0}
            step={0.01}
            placeholder="0"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Motivo</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo de terminación anticipada..."
            rows={3}
          />
        </div>

        {/* Liquidation preview */}
        <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
          <p className="font-medium text-sm mb-2">Vista previa de liquidación</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cuotas pendientes (est.)</span>
            <span className="tabular-nums">{formatCurrency(estimatedPending, currency, locale)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Penalidad</span>
            <span className="tabular-nums">{formatCurrency(penalty, currency, locale)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Depósito a devolver</span>
            <span className="tabular-nums">{formatCurrency(depositToReturn, currency, locale)}</span>
          </div>
          <div className="border-t pt-1 flex justify-between font-medium">
            <span>Saldo neto</span>
            <span className={`tabular-nums ${balance < 0 ? 'text-destructive' : 'text-success'}`}>
              {formatCurrency(balance, currency, locale)}
            </span>
          </div>
          <p className="text-muted-foreground pt-1">
            Los valores exactos se calculan al confirmar.
          </p>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
