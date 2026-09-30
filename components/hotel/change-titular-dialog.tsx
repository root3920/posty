'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { useGuests } from '@/hooks/use-hotel';
import { createClient } from '@/lib/supabase/client';
import { getSupabaseErrorMessage } from '@/lib/supabase/errors';
import type { Tables } from '@/types/database';

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface ChangeTitularDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stayId: string;
  currentGuestName: string;
  onChanged?: () => void;
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function ChangeTitularDialog({
  open,
  onOpenChange,
  stayId,
  currentGuestName,
  onChanged,
}: ChangeTitularDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Tables<'guests'> | null>(null);
  const [reason, setReason] = useState('');
  const [isPending, setIsPending] = useState(false);

  const { data: guests = [], isLoading } = useGuests(search);

  async function handleConfirm() {
    if (!selectedGuest) return;
    setIsPending(true);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('change_stay_titular', {
        p_stay_id: stayId,
        p_new_guest_id: selectedGuest.id,
        p_reason: reason || null,
      });
      if (error) throw error;

      toast.success(`Titular cambiado a ${selectedGuest.first_name} ${selectedGuest.last_name}`);
      queryClient.invalidateQueries({ queryKey: ['hotel_stay_detail', stayId] });
      queryClient.invalidateQueries({ queryKey: ['stay_tasks', stayId] });
      queryClient.invalidateQueries({ queryKey: ['audit_log', 'stay', stayId] });

      onChanged?.();
      handleClose(false);
    } catch (err) {
      toast.error(getSupabaseErrorMessage(err, 'cambiar titular'));
    } finally {
      setIsPending(false);
    }
  }

  function handleClose(open: boolean) {
    onOpenChange(open);
    if (!open) {
      setSearch('');
      setSelectedGuest(null);
      setReason('');
    }
  }

  const footer = selectedGuest ? (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => setSelectedGuest(null)} disabled={isPending}>
        Atrás
      </Button>
      <Button size="sm" onClick={handleConfirm} disabled={isPending} className="flex-1">
        {isPending ? 'Guardando...' : 'Confirmar cambio'}
      </Button>
    </div>
  ) : undefined;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleClose}
      title="Cambiar titular"
      description={`Actual: ${currentGuestName}`}
      footer={footer}
    >
      <div className="space-y-4 py-1">
        {selectedGuest ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm space-y-0.5">
              <p className="text-xs text-muted-foreground">Nuevo titular</p>
              <p className="font-semibold">{selectedGuest.first_name} {selectedGuest.last_name}</p>
              {selectedGuest.document_number && (
                <p className="text-xs text-muted-foreground">{selectedGuest.document_number}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Motivo (opcional)</Label>
              <Textarea
                placeholder="Ej: Error en el registro inicial"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Buscar nuevo titular</Label>
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
                    onClick={() => setSelectedGuest(g)}
                    className="w-full rounded-lg border bg-card px-3 py-2.5 text-left text-sm hover:bg-muted/30 transition-colors"
                  >
                    <p className="font-medium">{g.first_name} {g.last_name}</p>
                    <p className="text-xs text-muted-foreground">{g.document_number ?? 'Sin documento'}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
