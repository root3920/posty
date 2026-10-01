'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Receipt } from 'lucide-react';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/use-profile';

// -------------------------------------------------------
// Schema
// -------------------------------------------------------

const facturacionSchema = z.object({
  dian_regime: z.string().min(1, 'Selecciona un régimen'),
  dian_fiscal_responsibilities: z.string().optional(),
  dian_ciiu_code: z.string().optional(),
  dian_numbering_prefix: z.string().optional(),
  dian_numbering_from: z.coerce.number().int().nonnegative().optional(),
  dian_numbering_to: z.coerce.number().int().nonnegative().optional(),
  dian_resolution_number: z.string().optional(),
  dian_resolution_date: z.string().optional(),
  dian_provider: z.string().optional(),
  dian_provider_api_key: z.string().optional(),
  ica_rate: z.coerce.number().min(0).max(100).optional(),
  consumption_tax_rate: z.coerce.number().min(0).max(100).optional(),
});

type FacturacionFormValues = z.infer<typeof facturacionSchema>;

// -------------------------------------------------------
// Options
// -------------------------------------------------------

const DIAN_REGIMES = [
  { value: 'responsable_iva', label: 'Responsable de IVA' },
  { value: 'no_responsable', label: 'No responsable de IVA (antes RCS)' },
  { value: 'gran_contribuyente', label: 'Gran contribuyente' },
  { value: 'regimen_simple', label: 'Régimen simple de tributación' },
];

const DIAN_PROVIDERS = [
  { value: 'alegra', label: 'Alegra' },
  { value: 'siigo', label: 'Siigo' },
  { value: 'factory_hka', label: 'Factory HKA' },
];

const FISCAL_RESPONSIBILITIES_OPTIONS = [
  { value: 'O-13', label: 'O-13 — Gran contribuyente' },
  { value: 'O-15', label: 'O-15 — Autorretenedor' },
  { value: 'O-23', label: 'O-23 — Agente de retención IVA' },
  { value: 'O-47', label: 'O-47 — Régimen simple tributación' },
  { value: 'R-99-PN', label: 'R-99-PN — No aplica' },
];

// -------------------------------------------------------
// Fetch organization
// -------------------------------------------------------

interface OrgFacturacion {
  id: string;
  dian_regime: string | null;
  dian_fiscal_responsibilities: string | null;
  dian_ciiu_code: string | null;
  dian_numbering_prefix: string | null;
  dian_numbering_from: number | null;
  dian_numbering_to: number | null;
  dian_resolution_number: string | null;
  dian_resolution_date: string | null;
  dian_provider: string | null;
  dian_provider_api_key: string | null;
  ica_rate: number | null;
  consumption_tax_rate: number | null;
}

async function fetchOrganization(orgId: string): Promise<OrgFacturacion> {
  const supabase = createClient();
  const { data, error } = await (supabase as any)
    .from('organizations')
    .select(
      'id, dian_regime, dian_fiscal_responsibilities, dian_ciiu_code, dian_numbering_prefix, dian_numbering_from, dian_numbering_to, dian_resolution_number, dian_resolution_date, dian_provider, dian_provider_api_key, ica_rate, consumption_tax_rate'
    )
    .eq('id', orgId)
    .single();
  if (error) throw error;
  return data as OrgFacturacion;
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function FacturacionPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const orgId = profile?.organization_id;

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization_facturacion', orgId],
    queryFn: () => fetchOrganization(orgId!),
    enabled: !!orgId,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FacturacionFormValues>({
    resolver: zodResolver(facturacionSchema),
    defaultValues: {
      dian_regime: 'responsable_iva',
      dian_fiscal_responsibilities: '',
      dian_ciiu_code: '',
      dian_numbering_prefix: '',
      dian_numbering_from: undefined,
      dian_numbering_to: undefined,
      dian_resolution_number: '',
      dian_resolution_date: '',
      dian_provider: '',
      dian_provider_api_key: '',
      ica_rate: undefined,
      consumption_tax_rate: undefined,
    },
  });

  useEffect(() => {
    if (org) {
      reset({
        dian_regime: org.dian_regime ?? 'responsable_iva',
        dian_fiscal_responsibilities: org.dian_fiscal_responsibilities ?? '',
        dian_ciiu_code: org.dian_ciiu_code ?? '',
        dian_numbering_prefix: org.dian_numbering_prefix ?? '',
        dian_numbering_from: org.dian_numbering_from ?? undefined,
        dian_numbering_to: org.dian_numbering_to ?? undefined,
        dian_resolution_number: org.dian_resolution_number ?? '',
        dian_resolution_date: org.dian_resolution_date ?? '',
        dian_provider: org.dian_provider ?? '',
        dian_provider_api_key: org.dian_provider_api_key ?? '',
        ica_rate: org.ica_rate ?? undefined,
        consumption_tax_rate: org.consumption_tax_rate ?? undefined,
      });
    }
  }, [org, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FacturacionFormValues) => {
      const supabase = createClient();
      const { error } = await (supabase as any)
        .from('organizations')
        .update({
          dian_regime: values.dian_regime || null,
          dian_fiscal_responsibilities: values.dian_fiscal_responsibilities || null,
          dian_ciiu_code: values.dian_ciiu_code || null,
          dian_numbering_prefix: values.dian_numbering_prefix || null,
          dian_numbering_from: values.dian_numbering_from ?? null,
          dian_numbering_to: values.dian_numbering_to ?? null,
          dian_resolution_number: values.dian_resolution_number || null,
          dian_resolution_date: values.dian_resolution_date || null,
          dian_provider: values.dian_provider || null,
          dian_provider_api_key: values.dian_provider_api_key || null,
          ica_rate: values.ica_rate ?? null,
          consumption_tax_rate: values.consumption_tax_rate ?? null,
        })
        .eq('id', orgId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configuración de facturación guardada');
      queryClient.invalidateQueries({ queryKey: ['organization_facturacion', orgId] });
    },
    onError: (error) => {
      logSupabaseError(error, 'organizations:facturacion');
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  const onSubmit = (values: FacturacionFormValues) => mutation.mutate(values);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Receipt className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturación electrónica</h1>
          <p className="text-sm text-muted-foreground">
            Configuración DIAN para facturación electrónica
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">

          {/* Régimen tributario */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Régimen tributario</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Información fiscal del establecimiento ante la DIAN
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Régimen *</Label>
                <Select
                  value={watch('dian_regime') ?? 'responsable_iva'}
                  onValueChange={(v) => setValue('dian_regime', v ?? 'responsable_iva', { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAN_REGIMES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.dian_regime && (
                  <p className="text-xs text-destructive">{errors.dian_regime.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dian_ciiu_code">Código CIIU</Label>
                <Input
                  id="dian_ciiu_code"
                  placeholder="ej. 5511"
                  {...register('dian_ciiu_code')}
                />
                <p className="text-xs text-muted-foreground">
                  Clasificación Industrial Internacional Uniforme
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Responsabilidades fiscales</Label>
              <Select
                value={watch('dian_fiscal_responsibilities') ?? ''}
                onValueChange={(v) => setValue('dian_fiscal_responsibilities', v ?? '', { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una responsabilidad" />
                </SelectTrigger>
                <SelectContent>
                  {FISCAL_RESPONSIBILITIES_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Responsabilidad fiscal principal. Puedes ingresar valores adicionales separados por coma.
              </p>
            </div>
          </div>

          {/* Resolución de numeración */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Resolución de numeración DIAN</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Datos de la resolución habilitante otorgada por la DIAN para facturar electrónicamente
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dian_resolution_number">Número de resolución</Label>
                <Input
                  id="dian_resolution_number"
                  placeholder="ej. 18764000001234"
                  {...register('dian_resolution_number')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dian_resolution_date">Fecha de resolución</Label>
                <Input
                  id="dian_resolution_date"
                  type="date"
                  {...register('dian_resolution_date')}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="dian_numbering_prefix">Prefijo</Label>
                <Input
                  id="dian_numbering_prefix"
                  placeholder="ej. FV"
                  {...register('dian_numbering_prefix')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dian_numbering_from">Numeración desde</Label>
                <Input
                  id="dian_numbering_from"
                  type="number"
                  min={0}
                  placeholder="ej. 1"
                  {...register('dian_numbering_from')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dian_numbering_to">Numeración hasta</Label>
                <Input
                  id="dian_numbering_to"
                  type="number"
                  min={0}
                  placeholder="ej. 5000"
                  {...register('dian_numbering_to')}
                />
              </div>
            </div>
          </div>

          {/* Proveedor tecnológico */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Proveedor tecnológico</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Proveedor autorizado DIAN para la emisión y validación de facturas electrónicas
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Select
                value={watch('dian_provider') ?? ''}
                onValueChange={(v) => setValue('dian_provider', v ?? '', { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {DIAN_PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dian_provider_api_key">API Key del proveedor</Label>
              <Input
                id="dian_provider_api_key"
                type="password"
                placeholder="Clave de API para integración"
                autoComplete="new-password"
                {...register('dian_provider_api_key')}
              />
              <p className="text-xs text-muted-foreground">
                La clave se almacena cifrada y nunca se muestra en texto plano
              </p>
            </div>

            {watch('dian_provider') && (
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                Proveedor seleccionado: <strong>{DIAN_PROVIDERS.find((p) => p.value === watch('dian_provider'))?.label}</strong>.
                Asegúrate de que tu cuenta en {DIAN_PROVIDERS.find((p) => p.value === watch('dian_provider'))?.label} esté
                configurada para facturación electrónica DIAN.
              </div>
            )}
          </div>

          {/* Impuestos locales */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Impuestos locales</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tasas de impuestos locales aplicables a la facturación del hotel
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ica_rate">Tasa ICA (%)</Label>
                <Input
                  id="ica_rate"
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  placeholder="ej. 0.966"
                  {...register('ica_rate')}
                />
                <p className="text-xs text-muted-foreground">
                  Impuesto de industria y comercio. Varía según el municipio.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="consumption_tax_rate">Impuesto al consumo (%)</Label>
                <Input
                  id="consumption_tax_rate"
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  placeholder="ej. 8"
                  {...register('consumption_tax_rate')}
                />
                <p className="text-xs text-muted-foreground">
                  Aplica a servicios de alojamiento y restaurante (por defecto 8%).
                </p>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
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
