'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { EntitySelect } from '@/components/shared/entity-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

import { createClient } from '@/lib/supabase/client';
import { getSupabaseErrorMessage } from '@/lib/supabase/errors';
import { useBookingChannels, useTravelReasons } from '@/hooks/use-hotel';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface StayEditData {
  id: string;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  rate_per_night: number;
  channel_id: string | null;
  travel_reason_id: string | null;
  notes: string | null;
}

// -------------------------------------------------------
// Fetch
// -------------------------------------------------------

async function fetchStayForEdit(stayId: string): Promise<StayEditData | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stays')
    .select(
      'id, check_in_date, check_out_date, adults, children, rate_per_night, channel_id, travel_reason_id, notes',
    )
    .eq('id', stayId)
    .single();
  if (error) throw error;
  return data as StayEditData;
}

// -------------------------------------------------------
// Form state
// -------------------------------------------------------

interface FormValues {
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  rate_per_night: number;
  channel_id: string | null;
  travel_reason_id: string | null;
  notes: string;
}

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface EditStayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stayId: string | null;
  onSaved?: () => void;
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function EditStayDialog({
  open,
  onOpenChange,
  stayId,
  onSaved,
}: EditStayDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<FormValues>({
    check_in_date: '',
    check_out_date: '',
    adults: 1,
    children: 0,
    rate_per_night: 0,
    channel_id: null,
    travel_reason_id: null,
    notes: '',
  });

  const { data: stay, isLoading } = useQuery({
    queryKey: ['stay_for_edit', stayId],
    queryFn: () => fetchStayForEdit(stayId!),
    enabled: !!stayId && open,
    staleTime: 15 * 1000,
  });

  const { data: channels = [], isLoading: loadingChannels } = useBookingChannels();
  const { data: travelReasons = [], isLoading: loadingReasons } = useTravelReasons();

  // Pre-fill form when stay data loads
  useEffect(() => {
    if (stay) {
      setForm({
        check_in_date: stay.check_in_date,
        check_out_date: stay.check_out_date,
        adults: stay.adults,
        children: stay.children,
        rate_per_night: stay.rate_per_night,
        channel_id: stay.channel_id,
        travel_reason_id: stay.travel_reason_id,
        notes: stay.notes ?? '',
      });
    }
  }, [stay]);

  function handleChange(field: keyof FormValues, value: string | number | null) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!stayId) return;

    if (!form.check_in_date || !form.check_out_date) {
      toast.error('Las fechas de entrada y salida son obligatorias');
      return;
    }
    if (form.check_out_date <= form.check_in_date) {
      toast.error('La fecha de salida debe ser posterior a la fecha de entrada');
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('update_stay', {
        p_stay_id: stayId,
        p_check_in_date: form.check_in_date,
        p_check_out_date: form.check_out_date,
        p_adults: form.adults,
        p_children: form.children,
        p_rate_per_night: form.rate_per_night,
        p_channel_id: form.channel_id,
        p_travel_reason_id: form.travel_reason_id,
        p_notes: form.notes || null,
      });

      if (error) throw error;

      toast.success('Reserva actualizada correctamente');

      queryClient.invalidateQueries({ queryKey: ['stays_view'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });
      queryClient.invalidateQueries({ queryKey: ['stay_for_edit', stayId] });

      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(getSupabaseErrorMessage(err, 'Error al actualizar la reserva'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const channelOptions = channels.map((c) => ({ value: c.id, label: c.name }));
  const reasonOptions = travelReasons.map((r) => ({ value: r.id, label: r.name }));

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isSubmitting}
      >
        Cancelar
      </Button>
      <Button onClick={handleSubmit} disabled={isSubmitting || isLoading}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          'Guardar cambios'
        )}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editar reserva"
      description="Modifica los datos de la reserva"
      footer={footer}
    >
      {isLoading || !stay ? (
        <div className="space-y-3">
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Dates */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="edit-check-in">Fecha de entrada</Label>
              <Input
                id="edit-check-in"
                type="date"
                value={form.check_in_date}
                onChange={(e) => handleChange('check_in_date', e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="edit-check-out">Fecha de salida</Label>
              <Input
                id="edit-check-out"
                type="date"
                value={form.check_out_date}
                min={form.check_in_date || undefined}
                onChange={(e) => handleChange('check_out_date', e.target.value)}
              />
            </div>
          </div>

          {/* Guests */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="edit-adults">Adultos</Label>
              <Input
                id="edit-adults"
                type="number"
                min={1}
                max={20}
                value={form.adults}
                onChange={(e) =>
                  handleChange('adults', Math.max(1, parseInt(e.target.value, 10) || 1))
                }
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="edit-children">Niños</Label>
              <Input
                id="edit-children"
                type="number"
                min={0}
                max={20}
                value={form.children}
                onChange={(e) =>
                  handleChange('children', Math.max(0, parseInt(e.target.value, 10) || 0))
                }
              />
            </div>
          </div>

          {/* Rate */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-rate">Tarifa por noche</Label>
            <Input
              id="edit-rate"
              type="number"
              min={0}
              step={1000}
              value={form.rate_per_night}
              onChange={(e) =>
                handleChange('rate_per_night', parseFloat(e.target.value) || 0)
              }
            />
          </div>

          {/* Channel */}
          <div className="space-y-1.5">
            <Label>Canal de reserva</Label>
            <EntitySelect
              options={channelOptions}
              value={form.channel_id}
              onChange={(v) => handleChange('channel_id', v)}
              placeholder="Seleccionar canal..."
              isLoading={loadingChannels}
              allowClear
              clearLabel="Sin canal"
            />
          </div>

          {/* Travel reason */}
          <div className="space-y-1.5">
            <Label>Motivo de viaje</Label>
            <EntitySelect
              options={reasonOptions}
              value={form.travel_reason_id}
              onChange={(v) => handleChange('travel_reason_id', v)}
              placeholder="Seleccionar motivo..."
              isLoading={loadingReasons}
              allowClear
              clearLabel="Sin motivo"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notas</Label>
            <textarea
              id="edit-notes"
              rows={3}
              className="w-full rounded-[var(--radius)] border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Notas o comentarios de la reserva..."
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}
