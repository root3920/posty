'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Loader2, Calendar } from 'lucide-react';
import { toast } from 'sonner';

import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

import { createClient } from '@/lib/supabase/client';
import { getSupabaseErrorMessage } from '@/lib/supabase/errors';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface StayForExtend {
  id: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  room_number: string;
}

// -------------------------------------------------------
// Fetch
// -------------------------------------------------------

async function fetchStayForExtend(stayId: string): Promise<StayForExtend | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stays')
    .select(
      `
      id,
      check_in_date,
      check_out_date,
      nights,
      room:rooms(number)
      `,
    )
    .eq('id', stayId)
    .single();
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = data as any;
  return {
    id: raw.id,
    check_in_date: raw.check_in_date,
    check_out_date: raw.check_out_date,
    nights: raw.nights,
    room_number: raw.room?.number ?? '—',
  };
}

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface ExtendStayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stayId: string | null;
  onSaved?: () => void;
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function ExtendStayDialog({
  open,
  onOpenChange,
  stayId,
  onSaved,
}: ExtendStayDialogProps) {
  const queryClient = useQueryClient();
  const [newCheckOut, setNewCheckOut] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: stay, isLoading } = useQuery({
    queryKey: ['stay_for_extend', stayId],
    queryFn: () => fetchStayForExtend(stayId!),
    enabled: !!stayId && open,
    staleTime: 15 * 1000,
  });

  // Pre-fill with current check_out_date
  useEffect(() => {
    if (stay) {
      setNewCheckOut(stay.check_out_date);
    }
  }, [stay]);

  // Compute nights difference
  const nightsDiff =
    stay && newCheckOut && newCheckOut !== stay.check_out_date
      ? differenceInCalendarDays(parseISO(newCheckOut), parseISO(stay.check_out_date))
      : null;

  const nightsDiffLabel =
    nightsDiff !== null
      ? nightsDiff > 0
        ? `+${nightsDiff} ${nightsDiff === 1 ? 'noche' : 'noches'}`
        : `${nightsDiff} ${Math.abs(nightsDiff) === 1 ? 'noche' : 'noches'}`
      : null;

  const nightsDiffColor =
    nightsDiff !== null ? (nightsDiff > 0 ? 'text-success' : 'text-danger') : '';

  function handleOpenChange(v: boolean) {
    if (!v) setNewCheckOut('');
    onOpenChange(v);
  }

  async function handleSubmit() {
    if (!stayId || !stay) return;

    if (!newCheckOut) {
      toast.error('Ingresa la nueva fecha de salida');
      return;
    }
    if (newCheckOut <= stay.check_in_date) {
      toast.error('La nueva fecha de salida debe ser posterior a la fecha de entrada');
      return;
    }
    if (newCheckOut === stay.check_out_date) {
      toast.error('La nueva fecha de salida es igual a la actual');
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('extend_shorten_stay', {
        p_stay_id: stayId,
        p_new_check_out: newCheckOut,
      });
      if (error) throw error;

      const action = nightsDiff && nightsDiff > 0 ? 'extendida' : 'acortada';
      toast.success(`Estancia ${action} correctamente`);

      queryClient.invalidateQueries({ queryKey: ['stays_view'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });

      handleOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(getSupabaseErrorMessage(err, 'Error al modificar la estancia'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
        Cancelar
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={
          isSubmitting ||
          isLoading ||
          !newCheckOut ||
          newCheckOut === stay?.check_out_date
        }
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          'Confirmar cambio'
        )}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Extender o acortar estancia"
      description="Cambia la fecha de salida de la reserva"
      footer={footer}
    >
      {isLoading || !stay ? (
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Current stay info */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fechas actuales · Hab. {stay.room_number}</p>
              <p className="text-sm font-semibold">
                {stay.check_in_date} → {stay.check_out_date}
              </p>
              <p className="text-xs text-muted-foreground">
                {stay.nights} {stay.nights === 1 ? 'noche' : 'noches'}
              </p>
            </div>
          </div>

          {/* New check-out date */}
          <div className="space-y-1.5">
            <Label htmlFor="extend-check-out">Nueva fecha de salida</Label>
            <Input
              id="extend-check-out"
              type="date"
              value={newCheckOut}
              min={stay.check_in_date}
              onChange={(e) => setNewCheckOut(e.target.value)}
            />
          </div>

          {/* Nights diff badge */}
          {nightsDiffLabel && (
            <p className={`text-sm font-medium ${nightsDiffColor}`}>
              {nightsDiffLabel}
            </p>
          )}
        </div>
      )}
    </ResponsiveDialog>
  );
}
