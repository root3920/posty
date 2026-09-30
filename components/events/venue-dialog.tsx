'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimeSelect } from '@/components/shared/time-select';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

import { useCreateVenue, useUpdateVenue, type EventVenue } from '@/hooks/use-events';
import { PRICING_TYPE_LABELS } from './event-status-badge';

// -------------------------------------------------------
// Zod schema
// -------------------------------------------------------

const venueSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  pricing_type: z.enum(['per_hour', 'per_person', 'flat_rate']),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  deposit: z.coerce.number().min(0, 'El depósito no puede ser negativo'),
  max_capacity: z.coerce.number().int().min(1, 'La capacidad debe ser al menos 1'),
  open_time: z.string().min(1, 'La hora de apertura es obligatoria'),
  close_time: z.string().min(1, 'La hora de cierre es obligatoria'),
});

type VenueFormValues = z.infer<typeof venueSchema>;

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface VenueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue?: EventVenue | null;
  onSaved?: () => void;
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function VenueDialog({ open, onOpenChange, venue, onSaved }: VenueDialogProps) {
  const isEditing = !!venue;

  const createVenue = useCreateVenue();
  const updateVenue = useUpdateVenue();

  const isSubmitting = createVenue.isPending || updateVenue.isPending;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<VenueFormValues>({
    resolver: zodResolver(venueSchema),
    defaultValues: {
      name: '',
      description: '',
      pricing_type: 'per_hour',
      price: 0,
      deposit: 0,
      max_capacity: 50,
      open_time: '08:00',
      close_time: '22:00',
    },
  });

  const pricingType = watch('pricing_type');

  // Pre-fill form when editing
  useEffect(() => {
    if (venue) {
      reset({
        name: venue.name,
        description: venue.description ?? '',
        pricing_type: venue.pricing_type,
        price: venue.price,
        deposit: venue.deposit,
        max_capacity: venue.max_capacity,
        open_time: venue.open_time,
        close_time: venue.close_time,
      });
    } else {
      reset({
        name: '',
        description: '',
        pricing_type: 'per_hour',
        price: 0,
        deposit: 0,
        max_capacity: 50,
        open_time: '08:00',
        close_time: '22:00',
      });
    }
  }, [venue, reset]);

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function onSubmit(values: VenueFormValues) {
    try {
      if (isEditing && venue) {
        await updateVenue.mutateAsync({ id: venue.id, ...values });
      } else {
        await createVenue.mutateAsync(values);
      }
      handleOpenChange(false);
      onSaved?.();
    } catch {
      // errors handled by hook
    }
  }

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
        Cancelar
      </Button>
      <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          'Guardar'
        )}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={isEditing ? 'Editar espacio' : 'Agregar espacio'}
      footer={footer}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="venue-name">
            Nombre <span className="text-danger">*</span>
          </Label>
          <Input
            id="venue-name"
            placeholder="Ej. Terraza BBQ"
            {...register('name')}
          />
          {errors.name && (
            <p className="text-xs text-danger">{errors.name.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="venue-description">Descripción</Label>
          <textarea
            id="venue-description"
            rows={2}
            className="w-full rounded-[var(--radius)] border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Descripción del espacio..."
            {...register('description')}
          />
        </div>

        {/* Pricing type */}
        <div className="space-y-1.5">
          <Label htmlFor="venue-pricing-type">
            Tipo de tarifa <span className="text-danger">*</span>
          </Label>
          <Select
            value={pricingType}
            onValueChange={(v) => setValue('pricing_type', v as VenueFormValues['pricing_type'])}
          >
            <SelectTrigger id="venue-pricing-type">
              <span className={pricingType ? undefined : 'text-muted-foreground'}>
                {pricingType ? PRICING_TYPE_LABELS[pricingType] : 'Seleccionar...'}
              </span>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRICING_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.pricing_type && (
            <p className="text-xs text-danger">{errors.pricing_type.message}</p>
          )}
        </div>

        {/* Price + Deposit */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="venue-price">
              Precio (COP) <span className="text-danger">*</span>
            </Label>
            <Input
              id="venue-price"
              type="number"
              min={0}
              step={1000}
              {...register('price')}
            />
            {errors.price && (
              <p className="text-xs text-danger">{errors.price.message}</p>
            )}
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="venue-deposit">Depósito (COP)</Label>
            <Input
              id="venue-deposit"
              type="number"
              min={0}
              step={1000}
              {...register('deposit')}
            />
            {errors.deposit && (
              <p className="text-xs text-danger">{errors.deposit.message}</p>
            )}
          </div>
        </div>

        {/* Capacity */}
        <div className="space-y-1.5">
          <Label htmlFor="venue-capacity">
            Capacidad máxima (personas) <span className="text-danger">*</span>
          </Label>
          <Input
            id="venue-capacity"
            type="number"
            min={1}
            {...register('max_capacity')}
          />
          {errors.max_capacity && (
            <p className="text-xs text-danger">{errors.max_capacity.message}</p>
          )}
        </div>

        {/* Open/Close times */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label>
              Hora apertura <span className="text-danger">*</span>
            </Label>
            <Controller
              name="open_time"
              control={control}
              render={({ field }) => (
                <TimeSelect
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Apertura"
                />
              )}
            />
            {errors.open_time && (
              <p className="text-xs text-danger">{errors.open_time.message}</p>
            )}
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label>
              Hora cierre <span className="text-danger">*</span>
            </Label>
            <Controller
              name="close_time"
              control={control}
              render={({ field }) => (
                <TimeSelect
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Cierre"
                />
              )}
            />
            {errors.close_time && (
              <p className="text-xs text-danger">{errors.close_time.message}</p>
            )}
          </div>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
