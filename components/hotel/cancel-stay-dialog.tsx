'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { createClient } from '@/lib/supabase/client';
import { getSupabaseErrorMessage } from '@/lib/supabase/errors';

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface CancelStayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stayId: string | null;
  onSaved?: () => void;
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function CancelStayDialog({
  open,
  onOpenChange,
  stayId,
  onSaved,
}: CancelStayDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleOpenChange(v: boolean) {
    if (!v) setReason('');
    onOpenChange(v);
  }

  async function handleSubmit() {
    if (!stayId) return;

    if (!reason.trim()) {
      toast.error('El motivo de cancelación es obligatorio');
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('cancel_stay', {
        p_stay_id: stayId,
        p_reason: reason.trim(),
      });
      if (error) throw error;

      toast.success('Reserva cancelada');

      queryClient.invalidateQueries({ queryKey: ['stays_view'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });

      handleOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(getSupabaseErrorMessage(err, 'Error al cancelar la reserva'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
        Volver
      </Button>
      <Button
        variant="destructive"
        onClick={handleSubmit}
        disabled={isSubmitting || !reason.trim()}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cancelando...
          </>
        ) : (
          'Cancelar reserva'
        )}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Cancelar reserva"
      footer={footer}
    >
      <div className="space-y-4">
        {/* Warning */}
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-sm text-danger">
            Esta acción cancelará la reserva. Los cargos existentes se mantienen.
          </p>
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">
            Motivo de cancelación <span className="text-danger">*</span>
          </Label>
          <textarea
            id="cancel-reason"
            rows={4}
            className="w-full rounded-[var(--radius)] border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Describe el motivo de la cancelación..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
