'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { EntitySelect } from '@/components/shared/entity-select';
import { usePaymentMethods } from '@/hooks/use-hotel';
import {
  useRegisterContractPayment,
  useRegisterDepositPayment,
} from '@/hooks/use-contracts';
import { formatCurrency } from '@/lib/format';
import { useProfile } from '@/hooks/use-profile';

interface RegisterPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'installment' | 'deposit';
  targetId: string; // installment_id or contract_id
  suggestedAmount?: number;
  label?: string;
}

export function RegisterPaymentDialog({
  open,
  onOpenChange,
  mode,
  targetId,
  suggestedAmount = 0,
  label,
}: RegisterPaymentDialogProps) {
  const { data: profile } = useProfile();
  const currency = profile?.organization?.currency ?? 'COP';
  const locale = profile?.organization?.locale ?? 'es-CO';

  const { data: methods = [] } = usePaymentMethods();
  const registerPayment = useRegisterContractPayment();
  const registerDeposit = useRegisterDepositPayment();

  const [amount, setAmount] = useState(suggestedAmount);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [reference, setReference] = useState('');

  const isPending = registerPayment.isPending || registerDeposit.isPending;
  const valid = amount > 0 && !!methodId;

  function handleSubmit() {
    if (!valid || !methodId) return;

    if (mode === 'installment') {
      registerPayment.mutate(
        { installment_id: targetId, amount, method_id: methodId, reference: reference || undefined },
        { onSuccess: () => { onOpenChange(false); reset(); } },
      );
    } else {
      registerDeposit.mutate(
        { contract_id: targetId, amount, method_id: methodId, reference: reference || undefined },
        { onSuccess: () => { onOpenChange(false); reset(); } },
      );
    }
  }

  function reset() {
    setAmount(suggestedAmount);
    setMethodId(null);
    setReference('');
  }

  const footer = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
        Cancelar
      </Button>
      <Button type="button" disabled={!valid || isPending} onClick={handleSubmit}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar pago'}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'deposit' ? 'Pagar depósito de garantía' : 'Registrar pago de cuota'}
      description={label}
      footer={footer}
    >
      <div className="space-y-4">
        {suggestedAmount > 0 && (
          <p className="text-muted-foreground text-sm">
            Monto pendiente: {formatCurrency(suggestedAmount, currency, locale)}
          </p>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Monto *</Label>
          <Input
            type="number"
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value))}
            min={0}
            step={0.01}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Método de pago *</Label>
          <EntitySelect
            options={methods.map((m) => ({
              value: m.id,
              label: m.name,
            }))}
            value={methodId}
            onChange={(v) => setMethodId(v)}
            placeholder="Seleccionar método"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Referencia</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Número de recibo, transferencia, etc."
          />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
