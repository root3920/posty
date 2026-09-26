'use client';

import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  LogOut,
  Plus,
  CreditCard,
  CalendarPlus,
  ArrowRightLeft,
  Phone,
  Mail,
  Loader2,
  User,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  checkOutAction,
  addFolioChargeAction,
  registerPaymentAction,
  extendStayAction,
} from '@/app/actions/hotel';
import {
  folioChargeSchema,
  paymentSchema,
  extendStaySchema,
  type FolioChargeInput,
  type PaymentInput,
  type ExtendStayInput,
} from '@/lib/validations/hotel';
import { useStayDetail, useRevenueCenters, usePaymentMethods } from '@/hooks/use-hotel';
import { FolioTable } from './folio-table';
import { CheckInForm } from './check-in-form';
import type { RoomWithDetails } from '@/hooks/use-hotel';

// -------------------------------------------------------
// Currency formatter
// -------------------------------------------------------

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface RoomDetailDrawerProps {
  room: RoomWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// -------------------------------------------------------
// Add charge dialog
// -------------------------------------------------------

function AddChargeDialog({
  stayId,
  open,
  onOpenChange,
}: {
  stayId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: revenueCenters = [] } = useRevenueCenters();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FolioChargeInput>({
    resolver: zodResolver(folioChargeSchema) as any,
    defaultValues: { quantity: 1, taxRate: 0 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setServerError(null);
    const result = await addFolioChargeAction(stayId, data);
    setIsSubmitting(false);

    if ('error' in result && result.error) {
      setServerError(result.error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['hotel_stay_detail', stayId] });
      queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar cargo al folio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label className="text-xs">Centro de ingresos *</Label>
            <Select
              value={watch('revenueCenterId') ?? ''}
              onValueChange={(v) => { if (v) setValue('revenueCenterId', v); }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {revenueCenters.map((rc) => (
                  <SelectItem key={rc.id} value={rc.id}>
                    {rc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.revenueCenterId && (
              <p className="mt-0.5 text-xs text-red-500">{errors.revenueCenterId.message}</p>
            )}
          </div>
          <div>
            <Label className="text-xs">Descripción *</Label>
            <Input {...register('description')} placeholder="Ej. Desayuno, Minibar..." />
            {errors.description && (
              <p className="mt-0.5 text-xs text-red-500">{errors.description.message}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Cantidad</Label>
              <Input type="number" min={1} {...register('quantity', { valueAsNumber: true })} />
            </div>
            <div>
              <Label className="text-xs">Precio unitario</Label>
              <Input
                type="number"
                step="1000"
                {...register('unitPrice', { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs">IVA %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.5"
                {...register('taxRate', { valueAsNumber: true })}
              />
            </div>
          </div>
          {serverError && (
            <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-600">{serverError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Agregar cargo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------
// Register payment dialog
// -------------------------------------------------------

function RegisterPaymentDialog({
  stayId,
  balance,
  open,
  onOpenChange,
}: {
  stayId: string;
  balance: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: { amount: Math.max(balance, 0) },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setServerError(null);
    const result = await registerPaymentAction(stayId, data);
    setIsSubmitting(false);

    if ('error' in result && result.error) {
      setServerError(result.error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['hotel_stay_detail', stayId] });
      queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label className="text-xs">Monto *</Label>
            <Input
              type="number"
              step="1000"
              {...register('amount', { valueAsNumber: true })}
              placeholder="0"
            />
            {errors.amount && (
              <p className="mt-0.5 text-xs text-red-500">{errors.amount.message}</p>
            )}
          </div>
          <div>
            <Label className="text-xs">Método de pago *</Label>
            <Select
              value={watch('methodId') ?? ''}
              onValueChange={(v) => { if (v) setValue('methodId', v); }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((pm) => (
                  <SelectItem key={pm.id} value={pm.id}>
                    {pm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.methodId && (
              <p className="mt-0.5 text-xs text-red-500">{errors.methodId.message}</p>
            )}
          </div>
          <div>
            <Label className="text-xs">Referencia</Label>
            <Input {...register('reference')} placeholder="Número de transacción..." />
          </div>
          {serverError && (
            <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-600">{serverError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar pago'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------
// Extend stay dialog
// -------------------------------------------------------

function ExtendStayDialog({
  stayId,
  currentCheckOut,
  open,
  onOpenChange,
}: {
  stayId: string;
  currentCheckOut: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<ExtendStayInput>({
    resolver: zodResolver(extendStaySchema) as any,
    defaultValues: { newCheckOutDate: currentCheckOut },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setServerError(null);
    const result = await extendStayAction(stayId, data);
    setIsSubmitting(false);

    if ('error' in result && result.error) {
      setServerError(result.error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['hotel_stay_detail', stayId] });
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Extender estancia</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Salida actual:{' '}
            <strong>
              {format(new Date(`${currentCheckOut}T12:00:00`), "d 'de' MMMM yyyy", { locale: es })}
            </strong>
          </p>
          <div>
            <Label className="text-xs">Nueva fecha de salida *</Label>
            <Input type="date" {...register('newCheckOutDate')} min={currentCheckOut} />
            {errors.newCheckOutDate && (
              <p className="mt-0.5 text-xs text-red-500">{errors.newCheckOutDate.message}</p>
            )}
          </div>
          {serverError && (
            <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-600">{serverError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Extender'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------
// Main drawer
// -------------------------------------------------------

export function RoomDetailDrawer({ room, open, onOpenChange }: RoomDetailDrawerProps) {
  const queryClient = useQueryClient();
  const stayId = room?.current_stay?.id ?? null;

  const { data: stayDetail, isLoading } = useStayDetail(stayId);

  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  if (!room) return null;

  const isOccupied = !!room.current_stay;
  const stay = room.current_stay;

  const nightsRemaining = stay
    ? differenceInDays(new Date(`${stay.check_out_date}T12:00:00`), new Date())
    : 0;

  async function handleCheckOut() {
    if (!stayId) return;
    setIsCheckingOut(true);
    setCheckoutError(null);
    const result = await checkOutAction(stayId);
    setIsCheckingOut(false);

    if ('error' in result && result.error) {
      setCheckoutError(result.error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });
      onOpenChange(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <span className="text-xl font-bold">Hab. {room.number}</span>
              <Badge
                variant="outline"
                style={{
                  backgroundColor: `${room.room_status.color}25`,
                  borderColor: `${room.room_status.color}60`,
                  color: room.room_status.color,
                }}
              >
                {room.room_status.name}
              </Badge>
            </SheetTitle>
            <p className="text-sm text-muted-foreground">{room.room_type.name}</p>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* ============================= */}
            {/* Occupied: guest info */}
            {/* ============================= */}
            {isOccupied && stay && (
              <>
                {/* Guest info */}
                <div className="rounded-lg border p-4 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Huésped
                  </h3>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">
                        {stay.guest.first_name} {stay.guest.last_name}
                      </p>
                      {stay.guest.document_number && (
                        <p className="text-xs text-muted-foreground">
                          Doc: {stay.guest.document_number}
                        </p>
                      )}
                      {stay.guest.phone && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {stay.guest.phone}
                        </div>
                      )}
                      {stay.guest.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {stay.guest.email}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stay dates */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Entrada
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {format(new Date(`${stay.check_in_date}T12:00:00`), 'd MMM', { locale: es })}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Salida
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {format(
                        new Date(`${stay.check_out_date}T12:00:00`),
                        'd MMM',
                        { locale: es },
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Noches
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {nightsRemaining > 0 ? `${nightsRemaining} rest.` : 'Sale hoy'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tarifa por noche</span>
                  <span className="font-semibold">{copFormatter.format(stay.rate_per_night)}</span>
                </div>

                {/* Folio */}
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Folio
                  </h3>
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando folio...
                    </div>
                  ) : stayDetail ? (
                    <FolioTable
                      charges={stayDetail.folio_charges}
                      payments={stayDetail.payments}
                      balance={stayDetail.balance}
                    />
                  ) : null}
                </div>

                {/* Checkout error */}
                {checkoutError && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                    {checkoutError}
                  </p>
                )}

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowAddCharge(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Agregar cargo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowPayment(true)}
                  >
                    <CreditCard className="h-4 w-4" />
                    Registrar pago
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowExtend(true)}
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Extender estancia
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      /* TODO: change room */
                    }}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Cambiar habitación
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="col-span-2 gap-1.5"
                    onClick={handleCheckOut}
                    disabled={isCheckingOut}
                  >
                    {isCheckingOut ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    {isCheckingOut ? 'Procesando...' : 'Hacer Check-Out'}
                  </Button>
                </div>
              </>
            )}

            {/* ============================= */}
            {/* Available: quick check-in */}
            {/* ============================= */}
            {!isOccupied && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <User className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold">Habitación disponible</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tarifa base: {copFormatter.format(room.room_type.base_rate)}/noche
                  </p>
                </div>
                <Button onClick={() => setShowCheckIn(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Registrar Check-In
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sub-dialogs */}
      {stayId && (
        <>
          <AddChargeDialog
            stayId={stayId}
            open={showAddCharge}
            onOpenChange={setShowAddCharge}
          />
          <RegisterPaymentDialog
            stayId={stayId}
            balance={stayDetail?.balance.balance ?? 0}
            open={showPayment}
            onOpenChange={setShowPayment}
          />
          {stay && (
            <ExtendStayDialog
              stayId={stayId}
              currentCheckOut={stay.check_out_date}
              open={showExtend}
              onOpenChange={setShowExtend}
            />
          )}
        </>
      )}

      <CheckInForm
        open={showCheckIn}
        onOpenChange={setShowCheckIn}
        mode="checkin"
        defaultRoomId={room.id}
      />
    </>
  );
}
