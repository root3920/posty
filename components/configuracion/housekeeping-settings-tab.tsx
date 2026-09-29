'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, SprayCan } from 'lucide-react';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { useHousekeepingConfig } from '@/hooks/use-housekeeping';
import { useProfile } from '@/hooks/use-profile';

// -------------------------------------------------------
// Schema
// -------------------------------------------------------

const housekeepingSettingsSchema = z.object({
  frequency_days: z.coerce.number().int().min(1, 'Mínimo 1 día').max(90, 'Máximo 90 días'),
  default_time: z.string().min(1, 'Selecciona una hora'),
  require_inspection: z.boolean(),
  clean_before_arrival: z.boolean(),
  clean_after_checkout: z.boolean(),
  skip_pre_arrival_hours: z.coerce.number().int().min(0).max(72),
  vacant_refresh_days: z.coerce.number().int().min(0).max(90),
});

type HousekeepingSettingsValues = z.infer<typeof housekeepingSettingsSchema>;

const DEFAULTS: HousekeepingSettingsValues = {
  frequency_days: 7,
  default_time: '10:00',
  require_inspection: true,
  clean_before_arrival: true,
  clean_after_checkout: true,
  skip_pre_arrival_hours: 0,
  vacant_refresh_days: 0,
};

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export default function HousekeepingSettingsTab() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const orgId = profile?.organization_id;

  const { data: config, isLoading } = useHousekeepingConfig();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<HousekeepingSettingsValues>({
    resolver: zodResolver(housekeepingSettingsSchema),
    defaultValues: DEFAULTS,
  });

  // Populate form when config loads
  useEffect(() => {
    if (config) {
      reset({
        frequency_days: config.frequency_days ?? DEFAULTS.frequency_days,
        default_time: config.default_time ?? DEFAULTS.default_time,
        require_inspection: config.require_inspection ?? DEFAULTS.require_inspection,
        clean_before_arrival: config.clean_before_arrival ?? DEFAULTS.clean_before_arrival,
        clean_after_checkout: config.clean_after_checkout ?? DEFAULTS.clean_after_checkout,
        skip_pre_arrival_hours: config.skip_pre_arrival_hours ?? DEFAULTS.skip_pre_arrival_hours,
        vacant_refresh_days: config.vacant_refresh_days ?? DEFAULTS.vacant_refresh_days,
      });
    }
  }, [config, reset]);

  const mutation = useMutation({
    mutationFn: async (values: HousekeepingSettingsValues) => {
      if (!orgId) throw new Error('No se encontró la organización');

      const supabase = createClient();
      const { error } = await supabase
        .from('housekeeping_config')
        .upsert(
          {
            organization_id: orgId,
            frequency_days: values.frequency_days,
            default_time: values.default_time,
            require_inspection: values.require_inspection,
            clean_before_arrival: values.clean_before_arrival,
            clean_after_checkout: values.clean_after_checkout,
            skip_pre_arrival_hours: values.skip_pre_arrival_hours,
            vacant_refresh_days: values.vacant_refresh_days,
          },
          { onConflict: 'organization_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configuración de limpieza guardada');
      queryClient.invalidateQueries({ queryKey: ['housekeeping_config'] });
    },
    onError: (error) => {
      logSupabaseError(error, 'housekeeping_config:update');
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  const onSubmit = (values: HousekeepingSettingsValues) => mutation.mutate(values);

  // Watch values for controlled switches
  const requireInspection = watch('require_inspection');
  const cleanBeforeArrival = watch('clean_before_arrival');
  const cleanAfterCheckout = watch('clean_after_checkout');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SprayCan className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Limpieza</h1>
          <p className="text-sm text-muted-foreground">
            Frecuencia, horarios y reglas de limpieza automática
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 max-w-2xl">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
          {/* Frequency & time */}
          <div className="rounded-xl border bg-card p-5 space-y-5">
            <h2 className="text-sm font-semibold">Programación</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="frequency_days">
                  Frecuencia de limpieza en habitaciones ocupadas
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Cada</span>
                  <Input
                    id="frequency_days"
                    type="number"
                    min={1}
                    max={90}
                    className="w-20 tabular-nums"
                    {...register('frequency_days')}
                  />
                  <span className="text-sm text-muted-foreground">días</span>
                </div>
                {errors.frequency_days && (
                  <p className="text-xs text-destructive">{errors.frequency_days.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Se programará una limpieza automática cada N días para habitaciones con huéspedes
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="default_time">Hora por defecto de las limpiezas</Label>
                <Input
                  id="default_time"
                  type="time"
                  className="w-32"
                  {...register('default_time')}
                />
                {errors.default_time && (
                  <p className="text-xs text-destructive">{errors.default_time.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Hora a la que se programan las limpiezas automáticas
                </p>
              </div>
            </div>
          </div>

          {/* Toggle settings */}
          <div className="rounded-xl border bg-card p-5 space-y-5">
            <h2 className="text-sm font-semibold">Reglas automáticas</h2>

            {/* Clean before arrival */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="clean_before_arrival" className="text-sm font-medium">
                  Limpiar antes de cada llegada
                </Label>
                <p className="text-xs text-muted-foreground">
                  Programa una limpieza automática antes del check-in de cada huésped
                </p>
              </div>
              <Switch
                id="clean_before_arrival"
                checked={cleanBeforeArrival}
                onCheckedChange={(checked) =>
                  setValue('clean_before_arrival', checked, { shouldDirty: true })
                }
              />
            </div>

            {/* Skip pre-arrival hours (only visible when clean_before_arrival is on) */}
            {cleanBeforeArrival && (
              <div className="ml-4 border-l-2 border-muted pl-4 space-y-1.5">
                <Label htmlFor="skip_pre_arrival_hours" className="text-sm">
                  Omitir si faltan menos de
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="skip_pre_arrival_hours"
                    type="number"
                    min={0}
                    max={72}
                    className="w-20 tabular-nums"
                    {...register('skip_pre_arrival_hours')}
                  />
                  <span className="text-sm text-muted-foreground">horas para el check-in</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Si la reserva se crea con pocas horas de anticipación, no se programa limpieza previa. 0 = siempre programar.
                </p>
              </div>
            )}

            {/* Clean after checkout */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="clean_after_checkout" className="text-sm font-medium">
                  Limpiar al salir el huésped
                </Label>
                <p className="text-xs text-muted-foreground">
                  Programa una limpieza automática al realizar el check-out
                </p>
              </div>
              <Switch
                id="clean_after_checkout"
                checked={cleanAfterCheckout}
                onCheckedChange={(checked) =>
                  setValue('clean_after_checkout', checked, { shouldDirty: true })
                }
              />
            </div>

            {/* Vacant refresh */}
            <div className="space-y-1.5">
              <Label htmlFor="vacant_refresh_days" className="text-sm font-medium">
                Refrescar habitaciones vacías
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Cada</span>
                <Input
                  id="vacant_refresh_days"
                  type="number"
                  min={0}
                  max={90}
                  className="w-20 tabular-nums"
                  {...register('vacant_refresh_days')}
                />
                <span className="text-sm text-muted-foreground">días</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Programa limpiezas periódicas en habitaciones sin huéspedes. 0 = desactivado.
              </p>
            </div>
          </div>

          {/* Inspection */}
          <div className="rounded-xl border bg-card p-5 space-y-5">
            <h2 className="text-sm font-semibold">Inspección</h2>

            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="require_inspection" className="text-sm font-medium">
                  Requiere inspección de Ama de llaves
                </Label>
                <p className="text-xs text-muted-foreground">
                  Después de completar la limpieza, un supervisor debe aprobarla antes de que la habitación quede disponible
                </p>
              </div>
              <Switch
                id="require_inspection"
                checked={requireInspection}
                onCheckedChange={(checked) =>
                  setValue('require_inspection', checked, { shouldDirty: true })
                }
              />
            </div>
          </div>

          {/* Save button */}
          <Button
            type="submit"
            disabled={isSubmitting || mutation.isPending || !isDirty}
          >
            {(isSubmitting || mutation.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Guardar cambios
          </Button>
        </form>
      )}
    </div>
  );
}
