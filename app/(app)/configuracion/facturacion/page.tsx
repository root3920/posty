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

const taxSchema = z.object({
  accommodation_iva_rate: z.coerce.number().min(0).max(100),
  tax_rate: z.coerce.number().min(0).max(100),
  ica_rate: z.coerce.number().min(0).max(100),
  consumption_tax_rate: z.coerce.number().min(0).max(100),
});

type TaxFormValues = z.infer<typeof taxSchema>;

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function ImpuestosRecibosPage() {
  const { data: profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const { data: org, isLoading } = useQuery({
    queryKey: ['org_tax_config', orgId],
    queryFn: async () => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('organizations')
        .select('tax_rate, ica_rate, consumption_tax_rate, accommodation_iva_rate')
        .eq('id', orgId!)
        .single();
      if (error) throw error;
      return data as { tax_rate: number; ica_rate: number; consumption_tax_rate: number; accommodation_iva_rate: number };
    },
    enabled: !!orgId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<TaxFormValues>({
    resolver: zodResolver(taxSchema),
  });

  useEffect(() => {
    if (org) {
      reset({
        accommodation_iva_rate: org.accommodation_iva_rate,
        tax_rate: org.tax_rate,
        ica_rate: org.ica_rate,
        consumption_tax_rate: org.consumption_tax_rate,
      });
    }
  }, [org, reset]);

  const mutation = useMutation({
    mutationFn: async (values: TaxFormValues) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('organizations')
        .update(values)
        .eq('id', orgId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Impuestos guardados');
      queryClient.invalidateQueries({ queryKey: ['org_tax_config'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => {
      toast.error(getSupabaseErrorMessage(error, 'guardar impuestos'));
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
        <h1 className="text-2xl font-bold tracking-tight">Impuestos y recibos</h1>
        <p className="text-muted-foreground text-sm">
          Tasas impositivas para el cálculo de cargos. Los recibos de POSTY son documentos internos.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        <strong>Nota:</strong> POSTY no emite facturas electrónicas. Los recibos generados son documentos internos
        y llevan la leyenda "Documento interno · No válido como factura electrónica".
        Para la facturación electrónica, usa tu sistema de facturación autorizado por la DIAN.
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="accommodation_iva_rate">IVA de alojamiento (%)</Label>
            <Input
              id="accommodation_iva_rate"
              type="number"
              step="0.01"
              min={0}
              max={100}
              {...register('accommodation_iva_rate')}
            />
            {errors.accommodation_iva_rate && (
              <p className="text-destructive text-xs">{errors.accommodation_iva_rate.message}</p>
            )}
            <p className="text-muted-foreground text-xs">
              Los huéspedes extranjeros no residentes pueden estar exentos; confirma con tu contador
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax_rate">IVA general (%)</Label>
            <Input
              id="tax_rate"
              type="number"
              step="0.01"
              min={0}
              max={100}
              {...register('tax_rate')}
            />
            {errors.tax_rate && (
              <p className="text-destructive text-xs">{errors.tax_rate.message}</p>
            )}
            <p className="text-muted-foreground text-xs">
              Tasa general para otros cargos (minibar, lavandería, etc.)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ica_rate">ICA — Industria y comercio (%)</Label>
            <Input
              id="ica_rate"
              type="number"
              step="0.01"
              min={0}
              max={100}
              {...register('ica_rate')}
            />
            {errors.ica_rate && (
              <p className="text-destructive text-xs">{errors.ica_rate.message}</p>
            )}
            <p className="text-muted-foreground text-xs">
              Impuesto municipal. Varía por ciudad (Bogotá: 1.2%, otras: 0.4% a 1.4%)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="consumption_tax_rate">Impuesto al consumo (%)</Label>
            <Input
              id="consumption_tax_rate"
              type="number"
              step="0.01"
              min={0}
              max={100}
              {...register('consumption_tax_rate')}
            />
            {errors.consumption_tax_rate && (
              <p className="text-destructive text-xs">{errors.consumption_tax_rate.message}</p>
            )}
            <p className="text-muted-foreground text-xs">
              Aplica a servicios de restaurante y bar (8%)
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
