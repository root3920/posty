'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Globe,
  Loader2,
  ShieldCheck,
  CreditCard,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EntitySelect } from '@/components/shared/entity-select';

import { createClient } from '@/lib/supabase/client';
import { confirmArrivalAction } from '@/app/actions/workflow';

// -------------------------------------------------------
// Currency formatter
// -------------------------------------------------------

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// -------------------------------------------------------
// Fetch stay details for the modal
// -------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchStayForArrival(stayId: string): Promise<Record<string, any> | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stays')
    .select(
      `
      id,
      check_in_date,
      check_out_date,
      nights,
      rate_per_night,
      room_id,
      room:rooms(
        id,
        number,
        room_type_id,
        housekeeping_status,
        room_status:room_statuses(name, counts_as_available)
      ),
      guest:guests(
        first_name,
        last_name,
        document_number,
        phone,
        nationality
      )
      `,
    )
    .eq('id', stayId)
    .single();

  if (error) {
    console.error('fetchStayForArrival error:', error);
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as Record<string, any>;
}

// Fetch available rooms of same type (clean/inspected) for room change
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAvailableRoomsOfType(roomTypeId: string, excludeRoomId: string): Promise<{ id: string; number: string; housekeeping_status: string | null }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('rooms')
    .select('id, number, housekeeping_status, room_status:room_statuses(counts_as_available)')
    .eq('room_type_id', roomTypeId)
    .eq('is_active', true)
    .neq('id', excludeRoomId);

  if (error) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).filter((r: any) => r.room_status?.counts_as_available);
}

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface ConfirmArrivalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stayId: string | null;
  onConfirmed?: () => void;
}

// -------------------------------------------------------
// Modal
// -------------------------------------------------------

export function ConfirmArrivalModal({
  open,
  onOpenChange,
  stayId,
  onConfirmed,
}: ConfirmArrivalModalProps) {
  const queryClient = useQueryClient();

  const [documentVerified, setDocumentVerified] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: stay, isLoading } = useQuery({
    queryKey: ['stay_for_arrival', stayId],
    queryFn: () => fetchStayForArrival(stayId!),
    enabled: !!stayId && open,
    staleTime: 15 * 1000,
  });

  const roomTypeId = stay?.room?.room_type_id ?? null;
  const currentRoomId = stay?.room?.id ?? null;

  const { data: availableRooms = [] } = useQuery({
    queryKey: ['available_rooms_same_type', roomTypeId, currentRoomId],
    queryFn: () => fetchAvailableRoomsOfType(roomTypeId!, currentRoomId!),
    enabled: !!roomTypeId && !!currentRoomId && open,
    staleTime: 15 * 1000,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const room = stay?.room as Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guest = stay?.guest as Record<string, any> | null;

  const housekeepingStatus: string | null = room?.housekeeping_status ?? null;
  const isRoomClean = housekeepingStatus === 'clean' || housekeepingStatus === 'inspected';
  const isForeignGuest =
    guest?.nationality && guest.nationality.toLowerCase() !== 'colombia' && guest.nationality.toLowerCase() !== 'co';

  const balance = 0; // Placeholder — real balance would come from stay_balances

  async function handleConfirm() {
    if (!stayId) return;
    if (!documentVerified) {
      toast.error('Debe verificar el documento del huésped');
      return;
    }
    setIsSubmitting(true);
    const result = await confirmArrivalAction(stayId, documentVerified, paymentConfirmed);
    setIsSubmitting(false);

    if ('error' in result) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `Llegada confirmada · Hab. ${result.roomNumber}${result.tasksGenerated > 0 ? ` · ${result.tasksGenerated} tareas generadas` : ''}`,
    );

    queryClient.invalidateQueries({ queryKey: ['stays_view'] });
    queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
    queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });

    onOpenChange(false);
    onConfirmed?.();

    // Reset
    setDocumentVerified(false);
    setPaymentConfirmed(false);
    setSelectedRoomId(null);
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setDocumentVerified(false);
      setPaymentConfirmed(false);
      setSelectedRoomId(null);
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar llegada</DialogTitle>
        </DialogHeader>

        {isLoading || !stay ? (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Guest info */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {guest?.first_name} {guest?.last_name}
                  </p>
                  {guest?.document_number && (
                    <p className="text-xs text-muted-foreground">Doc: {guest.document_number}</p>
                  )}
                  {guest?.phone && (
                    <p className="text-xs text-muted-foreground">{guest.phone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Room + dates */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Habitación</p>
                <p className="mt-1 text-sm font-bold">{room?.number}</p>
                <Badge
                  variant="outline"
                  className={`mt-1 text-[9px] ${isRoomClean ? 'border-success/30 bg-success/10 text-success' : 'border-warning/30 bg-warning/10 text-warning'}`}
                >
                  {housekeepingStatus === 'clean' ? 'Limpia' : housekeepingStatus === 'inspected' ? 'Inspeccionada' : housekeepingStatus ?? 'Sin estado'}
                </Badge>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Noches</p>
                <p className="mt-1 text-sm font-bold">{stay.nights}</p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(`${stay.check_in_date}T12:00:00`), 'd MMM', { locale: es })}
                  {' – '}
                  {format(new Date(`${stay.check_out_date}T12:00:00`), 'd MMM', { locale: es })}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tarifa/noche</p>
                <p className="mt-1 text-sm font-bold">{copFormatter.format(stay.rate_per_night)}</p>
                <p className="text-[10px] text-muted-foreground">
                  Saldo: {copFormatter.format(balance)}
                </p>
              </div>
            </div>

            {/* Room not clean warning */}
            {!isRoomClean && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-warning text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="font-medium">La habitación no está lista</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Estado actual: <strong>{housekeepingStatus ?? 'desconocido'}</strong>.
                  Puedes cambiar al huésped a otra habitación disponible del mismo tipo.
                </p>
                {availableRooms.length > 0 && (
                  <div>
                    <Label className="text-xs mb-1 block">Cambiar a habitación</Label>
                    <EntitySelect
                      options={availableRooms.map((r) => ({
                        value: r.id,
                        label: `Hab. ${r.number} (${r.housekeeping_status === 'clean' ? 'Limpia' : r.housekeeping_status === 'inspected' ? 'Inspeccionada' : r.housekeeping_status ?? ''})`,
                      }))}
                      value={selectedRoomId}
                      onChange={setSelectedRoomId}
                      placeholder="Seleccionar habitación..."
                      allowClear
                      clearLabel="Mantener habitación actual"
                      size="sm"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Foreign guest banner */}
            {isForeignGuest && (
              <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-sm text-info">
                <Globe className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Huésped extranjero — Reportar en <strong>SIRE</strong> hoy</span>
              </div>
            )}

            {/* Verification checks */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="doc-verified"
                  checked={documentVerified}
                  onCheckedChange={(v) => setDocumentVerified(!!v)}
                />
                <Label htmlFor="doc-verified" className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  Documento verificado <span className="text-danger">*</span>
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="payment-confirmed"
                  checked={paymentConfirmed}
                  onCheckedChange={(v) => setPaymentConfirmed(!!v)}
                />
                <Label htmlFor="payment-confirmed" className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Garantía / pago confirmado
                </Label>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || isLoading || !documentVerified}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirmando...
              </>
            ) : (
              'Confirmar llegada'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
