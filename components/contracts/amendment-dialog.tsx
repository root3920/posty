'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { useCreateAmendment, type ContractViewRow } from '@/hooks/use-contracts';
import { formatCurrency } from '@/lib/format';
import { formatDateOnly } from '@/lib/dates';
import { useOrganization } from '@/hooks/use-organization';

interface AmendmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ContractViewRow;
  onCreated?: () => void;
}

type ChangeKey = 'monthly_rate' | 'end_date' | 'included_services' | 'cleaning_frequency_days';

const CHANGE_OPTIONS: { key: ChangeKey; label: string }[] = [
  { key: 'monthly_rate', label: 'Precio mensual' },
  { key: 'end_date', label: 'Fecha de fin' },
  { key: 'included_services', label: 'Servicios incluidos' },
  { key: 'cleaning_frequency_days', label: 'Frecuencia de limpieza' },
];

export function AmendmentDialog({ open, onOpenChange, contract, onCreated }: AmendmentDialogProps) {
  const { currency, locale } = useOrganization();
  const createAmendment = useCreateAmendment();

  const [selectedKeys, setSelectedKeys] = useState<Set<ChangeKey>>(new Set());
  const [values, setValues] = useState<Record<ChangeKey, string>>({
    monthly_rate: String(contract.monthly_rate),
    end_date: contract.end_date,
    included_services: contract.included_services.join(', '),
    cleaning_frequency_days: String(contract.cleaning_frequency_days),
  });
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reason, setReason] = useState('');

  function toggleKey(key: ChangeKey) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const valid = selectedKeys.size > 0 && !!effectiveDate;

  function handleSubmit() {
    if (!valid) return;

    const changes: Record<string, unknown> = {};
    selectedKeys.forEach((key) => {
      const raw = values[key];
      if (key === 'monthly_rate' || key === 'cleaning_frequency_days') {
        changes[key] = Number(raw);
      } else if (key === 'included_services') {
        changes[key] = raw.split(',').map((s) => s.trim()).filter(Boolean);
      } else {
        changes[key] = raw;
      }
    });

    createAmendment.mutate(
      {
        contract_id: contract.id,
        changes,
        effective_date: effectiveDate,
        reason: reason || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          reset();
          onCreated?.();
        },
      },
    );
  }

  function reset() {
    setSelectedKeys(new Set());
    setValues({
      monthly_rate: String(contract.monthly_rate),
      end_date: contract.end_date,
      included_services: contract.included_services.join(', '),
      cleaning_frequency_days: String(contract.cleaning_frequency_days),
    });
    setEffectiveDate('');
    setReason('');
  }

  const footer = (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={() => { onOpenChange(false); reset(); }}>
        Cancelar
      </Button>
      <Button
        type="button"
        disabled={!valid || createAmendment.isPending}
        onClick={handleSubmit}
      >
        {createAmendment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear otrosí'}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Crear otrosí"
      description={`Contrato ${contract.code} · Hab. ${contract.room_number}`}
      footer={footer}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Cambios a incluir *</Label>
          {CHANGE_OPTIONS.map((opt) => (
            <div key={opt.key} className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`chk-${opt.key}`}
                  checked={selectedKeys.has(opt.key)}
                  onCheckedChange={() => toggleKey(opt.key)}
                />
                <label htmlFor={`chk-${opt.key}`} className="text-sm cursor-pointer">
                  {opt.label}
                </label>
              </div>

              {selectedKeys.has(opt.key) && (
                <div className="ml-6 space-y-1">
                  <CurrentValueHint contractKey={opt.key} contract={contract} currency={currency} locale={locale} />
                  {opt.key === 'monthly_rate' && (
                    <Input
                      type="number"
                      value={values.monthly_rate}
                      onChange={(e) => setValues((v) => ({ ...v, monthly_rate: e.target.value }))}
                      min={0}
                      step={0.01}
                      placeholder="Nuevo precio mensual"
                    />
                  )}
                  {opt.key === 'end_date' && (
                    <Input
                      type="date"
                      value={values.end_date}
                      onChange={(e) => setValues((v) => ({ ...v, end_date: e.target.value }))}
                    />
                  )}
                  {opt.key === 'included_services' && (
                    <Input
                      value={values.included_services}
                      onChange={(e) => setValues((v) => ({ ...v, included_services: e.target.value }))}
                      placeholder="Servicios separados por coma"
                    />
                  )}
                  {opt.key === 'cleaning_frequency_days' && (
                    <Input
                      type="number"
                      value={values.cleaning_frequency_days}
                      onChange={(e) => setValues((v) => ({ ...v, cleaning_frequency_days: e.target.value }))}
                      min={1}
                      placeholder="Frecuencia en días"
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Fecha de vigencia *</Label>
          <Input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Motivo</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo del otrosí..."
            rows={3}
          />
        </div>
      </div>
    </ResponsiveDialog>
  );
}

// -------------------------------------------------------
// Helper: show current value for reference
// -------------------------------------------------------

function CurrentValueHint({
  contractKey,
  contract,
  currency,
  locale,
}: {
  contractKey: ChangeKey;
  contract: ContractViewRow;
  currency: string;
  locale: string;
}) {
  let hint = '';
  if (contractKey === 'monthly_rate') hint = `Actual: ${formatCurrency(contract.monthly_rate, currency, locale)}`;
  else if (contractKey === 'end_date') hint = `Actual: ${formatDateOnly(contract.end_date)}`;
  else if (contractKey === 'included_services') hint = `Actual: ${contract.included_services.join(', ') || 'Ninguno'}`;
  else if (contractKey === 'cleaning_frequency_days') hint = `Actual: cada ${contract.cleaning_frequency_days} días`;

  return hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null;
}
