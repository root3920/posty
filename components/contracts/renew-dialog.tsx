'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { addMonths, format } from 'date-fns';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { useRenewContract, type ContractViewRow } from '@/hooks/use-contracts';
import { formatCurrency } from '@/lib/format';
import { formatDateOnly, parseDateOnly } from '@/lib/dates';
import { useOrganization } from '@/hooks/use-organization';

interface RenewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ContractViewRow;
  onRenewed?: (newId: string) => void;
}

const DURATION_CHIPS = [
  { label: '3 meses', months: 3 },
  { label: '6 meses', months: 6 },
  { label: '12 meses', months: 12 },
];

export function RenewDialog({ open, onOpenChange, contract, onRenewed }: RenewDialogProps) {
  const { currency, locale } = useOrganization();
  const router = useRouter();
  const renew = useRenewContract();

  const currentEndDate = parseDateOnly(contract.end_date);
  const defaultNewEnd = format(addMonths(currentEndDate, 12), 'yyyy-MM-dd');

  const [newEndDate, setNewEndDate] = useState(defaultNewEnd);
  const [newRate, setNewRate] = useState(contract.monthly_rate);

  function applyChip(months: number) {
    const d = addMonths(currentEndDate, months);
    setNewEndDate(format(d, 'yyyy-MM-dd'));
  }

  const valid = !!newEndDate && newEndDate > contract.end_date && newRate > 0;

  function handleSubmit() {
    if (!valid) return;
    renew.mutate(
      {
        contract_id: contract.id,
        new_end_date: newEndDate,
        new_rate: newRate !== contract.monthly_rate ? newRate : undefined,
      },
      {
        onSuccess: (data) => {
          onOpenChange(false);
          onRenewed?.(data.new_contract_id);
          router.push(`/contratos/${data.new_contract_id}`);
        },
      },
    );
  }

  const footer = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
        Cancelar
      </Button>
      <Button type="button" disabled={!valid || renew.isPending} onClick={handleSubmit}>
        {renew.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Renovar contrato'}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Renovar contrato"
      description={`Contrato ${contract.code} · Hab. ${contract.room_number}`}
      footer={footer}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Nueva fecha de fin *</Label>
          <div className="flex flex-wrap gap-2">
            {DURATION_CHIPS.map((chip) => (
              <Button
                key={chip.months}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => applyChip(chip.months)}
              >
                {chip.label}
              </Button>
            ))}
          </div>
          <Input
            type="date"
            value={newEndDate}
            min={contract.end_date}
            onChange={(e) => setNewEndDate(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Precio mensual *</Label>
          <Input
            type="number"
            value={newRate || ''}
            onChange={(e) => setNewRate(Number(e.target.value))}
            min={0}
            step={0.01}
          />
        </div>

        {/* Preview */}
        {valid && (
          <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
            <p className="font-medium">Vista previa de renovación</p>
            <p className="text-muted-foreground">
              Nuevo contrato desde{' '}
              <span className="text-foreground font-medium">{formatDateOnly(contract.end_date)}</span>
              {' '}hasta{' '}
              <span className="text-foreground font-medium">{formatDateOnly(newEndDate)}</span>
              {' '}a{' '}
              <span className="text-foreground font-medium">
                {formatCurrency(newRate, currency, locale)}/mes
              </span>
            </p>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
