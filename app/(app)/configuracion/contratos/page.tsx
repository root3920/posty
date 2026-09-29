'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { getSupabaseErrorMessage } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/use-profile';

// -------------------------------------------------------
// Schema
// -------------------------------------------------------

const contractConfigSchema = z.object({
  contract_min_nights: z.coerce.number().min(7, 'Mínimo 7 noches'),
  contract_default_payment_day: z.coerce.number().min(1).max(28),
  contract_default_deposit_months: z.coerce.number().min(0).max(12),
  contract_provisional_hours: z.coerce.number().min(1).max(168),
});

type ContractConfigValues = z.infer<typeof contractConfigSchema>;

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function ContractConfigPage() {
  const { data: profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization_contract_config', orgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('organizations')
        .select(
          'contract_min_nights, contract_default_payment_day, contract_default_deposit_months, contract_provisional_hours',
        )
        .eq('id', orgId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ContractConfigValues>({
    resolver: zodResolver(contractConfigSchema),
  });

  useEffect(() => {
    if (org) {
      reset({
        contract_min_nights: org.contract_min_nights,
        contract_default_payment_day: org.contract_default_payment_day,
        contract_default_deposit_months: org.contract_default_deposit_months,
        contract_provisional_hours: org.contract_provisional_hours,
      });
    }
  }, [org, reset]);

  const mutation = useMutation({
    mutationFn: async (values: ContractConfigValues) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('organizations')
        .update(values)
        .eq('id', orgId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configuración de contratos guardada');
      queryClient.invalidateQueries({ queryKey: ['organization_contract_config'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'guardar configuración'));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contratos de larga estadía</h1>
        <p className="text-muted-foreground text-sm">
          Valores por defecto para nuevos contratos
        </p>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contract_min_nights">
              Mínimo de noches para larga estadía
            </Label>
            <Input
              id="contract_min_nights"
              type="number"
              {...register('contract_min_nights')}
            />
            {errors.contract_min_nights && (
              <p className="text-destructive text-xs">{errors.contract_min_nights.message}</p>
            )}
            <p className="text-muted-foreground text-xs">
              Desde cuántas noches se considera larga estadía
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contract_default_payment_day">
              Día de pago por defecto
            </Label>
            <Input
              id="contract_default_payment_day"
              type="number"
              min={1}
              max={28}
              {...register('contract_default_payment_day')}
            />
            {errors.contract_default_payment_day && (
              <p className="text-destructive text-xs">
                {errors.contract_default_payment_day.message}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Día del mes en que se cobra la cuota (1–28)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contract_default_deposit_months">
              Depósito sugerido (meses)
            </Label>
            <Input
              id="contract_default_deposit_months"
              type="number"
              min={0}
              max={12}
              {...register('contract_default_deposit_months')}
            />
            {errors.contract_default_deposit_months && (
              <p className="text-destructive text-xs">
                {errors.contract_default_deposit_months.message}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Número de meses de depósito de garantía sugeridos (0 = sin depósito)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contract_provisional_hours">
              Reserva provisional (horas)
            </Label>
            <Input
              id="contract_provisional_hours"
              type="number"
              min={1}
              max={168}
              {...register('contract_provisional_hours')}
            />
            {errors.contract_provisional_hours && (
              <p className="text-destructive text-xs">
                {errors.contract_provisional_hours.message}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Horas que se reserva provisionalmente la habitación mientras se firma el contrato
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty || mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
