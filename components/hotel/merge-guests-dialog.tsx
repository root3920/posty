'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { useGuests, useMergeGuests } from '@/hooks/use-hotel';
import type { Tables } from '@/types/database';

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface MergeGuestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId: string;
  guestName: string;
  onMerged?: () => void;
}

// -------------------------------------------------------
// Step 1 — Search
// -------------------------------------------------------

function SearchStep({
  keepName,
  onSelect,
}: {
  keepName: string;
  onSelect: (guest: Tables<'guests'>) => void;
}) {
  const [search, setSearch] = useState('');
  const { data: guests = [], isLoading } = useGuests(search);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Huésped a conservar: </span>
        <span className="font-semibold">{keepName}</span>
      </div>

      <div className="space-y-1.5">
        <Label>Buscar duplicado</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nombre, documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)
        ) : guests.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sin resultados</p>
        ) : (
          guests.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelect(g)}
              className="w-full rounded-lg border bg-card px-3 py-2.5 text-left text-sm hover:bg-muted/30 transition-colors"
            >
              <p className="font-medium">{g.first_name} {g.last_name}</p>
              <p className="text-xs text-muted-foreground">{g.document_number ?? 'Sin documento'}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Step 2 — Preview + reason
// -------------------------------------------------------

function PreviewStep({
  keepName,
  mergeGuest,
  reason,
  onReasonChange,
  onBack,
  onConfirm,
  isPending,
}: {
  keepName: string;
  mergeGuest: Tables<'guests'>;
  reason: string;
  onReasonChange: (v: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const mergeName = `${mergeGuest.first_name} ${mergeGuest.last_name}`;

  return (
    <div className="space-y-4">
      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-3">
        <GuestCard label="Conservar" name={keepName} highlight />
        <GuestCard
          label="Fusionar (se elimina)"
          name={mergeName}
          doc={mergeGuest.document_number ?? undefined}
          phone={mergeGuest.phone ?? undefined}
          email={mergeGuest.email ?? undefined}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Las estancias, contratos y chats de <strong>{mergeName}</strong> pasarán a <strong>{keepName}</strong>.
        Esta acción no se puede deshacer.
      </p>

      <div className="space-y-1.5">
        <Label>Motivo (opcional)</Label>
        <Textarea
          placeholder="Ej: Registros duplicados del mismo huésped"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onBack} disabled={isPending}>
          Atrás
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onConfirm}
          disabled={isPending}
          className="flex-1"
        >
          {isPending ? 'Fusionando...' : 'Confirmar fusión'}
        </Button>
      </div>
    </div>
  );
}

function GuestCard({
  label,
  name,
  doc,
  phone,
  email,
  highlight,
}: {
  label: string;
  name: string;
  doc?: string;
  phone?: string;
  email?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-2.5 text-xs space-y-0.5 ${highlight ? 'border-primary/40 bg-primary/5' : 'bg-muted/30'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm">{name}</p>
      {doc && <p className="text-muted-foreground">{doc}</p>}
      {phone && <p className="text-muted-foreground">{phone}</p>}
      {email && <p className="text-muted-foreground truncate">{email}</p>}
    </div>
  );
}

// -------------------------------------------------------
// Main dialog
// -------------------------------------------------------

export function MergeGuestsDialog({
  open,
  onOpenChange,
  guestId,
  guestName,
  onMerged,
}: MergeGuestsDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedGuest, setSelectedGuest] = useState<Tables<'guests'> | null>(null);
  const [reason, setReason] = useState('');

  const merge = useMergeGuests();

  function handleSelect(guest: Tables<'guests'>) {
    setSelectedGuest(guest);
    setStep(2);
  }

  function handleConfirm() {
    if (!selectedGuest) return;
    merge.mutate(
      { keep_id: guestId, merge_id: selectedGuest.id, reason: reason || undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          onMerged?.();
          // Reset state
          setStep(1);
          setSelectedGuest(null);
          setReason('');
        },
      },
    );
  }

  function handleClose(open: boolean) {
    onOpenChange(open);
    if (!open) {
      setStep(1);
      setSelectedGuest(null);
      setReason('');
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleClose}
      title="Fusionar huéspedes"
      description={step === 1 ? 'Paso 1: elige el duplicado' : 'Paso 2: confirma la fusión'}
      size="md"
    >
      <div className="py-1">
        {step === 1 ? (
          <SearchStep keepName={guestName} onSelect={handleSelect} />
        ) : selectedGuest ? (
          <PreviewStep
            keepName={guestName}
            mergeGuest={selectedGuest}
            reason={reason}
            onReasonChange={setReason}
            onBack={() => setStep(1)}
            onConfirm={handleConfirm}
            isPending={merge.isPending}
          />
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}
