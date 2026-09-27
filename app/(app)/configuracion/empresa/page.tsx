'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Building2, Upload } from 'lucide-react';
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

const empresaSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  tax_id: z.string().optional(),
  currency: z.string().min(1, 'Selecciona una moneda'),
  locale: z.string().min(1, 'Selecciona un locale'),
  timezone: z.string().min(1, 'Selecciona una zona horaria'),
  date_format: z.string().min(1, 'Selecciona un formato de fecha'),
  default_check_in_time: z.string().min(1),
  default_check_out_time: z.string().min(1),
  tax_rate: z.coerce.number().min(0).max(100),
});

type EmpresaFormValues = z.infer<typeof empresaSchema>;

// -------------------------------------------------------
// Options
// -------------------------------------------------------

const CURRENCIES = [
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'USD', label: 'USD — Dólar estadounidense' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'PEN', label: 'PEN — Sol peruano' },
  { value: 'CLP', label: 'CLP — Peso chileno' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
];

const LOCALES = [
  { value: 'es-CO', label: 'Español (Colombia)' },
  { value: 'es-MX', label: 'Español (México)' },
  { value: 'es-PE', label: 'Español (Perú)' },
  { value: 'es-CL', label: 'Español (Chile)' },
  { value: 'es-AR', label: 'Español (Argentina)' },
  { value: 'es', label: 'Español (genérico)' },
  { value: 'en-US', label: 'English (US)' },
];

const TIMEZONES = [
  { value: 'America/Bogota', label: 'Bogotá (UTC-5)' },
  { value: 'America/Mexico_City', label: 'Ciudad de México (UTC-6)' },
  { value: 'America/Lima', label: 'Lima (UTC-5)' },
  { value: 'America/Santiago', label: 'Santiago (UTC-3/-4)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (UTC-3)' },
  { value: 'America/New_York', label: 'Nueva York (UTC-5/-4)' },
  { value: 'Europe/Madrid', label: 'Madrid (UTC+1/+2)' },
  { value: 'UTC', label: 'UTC' },
];

const DATE_FORMATS = [
  { value: 'dd/MM/yyyy', label: 'DD/MM/AAAA (31/12/2024)' },
  { value: 'MM/dd/yyyy', label: 'MM/DD/AAAA (12/31/2024)' },
  { value: 'yyyy-MM-dd', label: 'AAAA-MM-DD (2024-12-31)' },
  { value: 'd MMMM yyyy', label: 'D de mes AAAA (31 diciembre 2024)' },
];

// -------------------------------------------------------
// Fetch organization
// -------------------------------------------------------

async function fetchOrganization(orgId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();
  if (error) throw error;
  return data;
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function EmpresaPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const orgId = profile?.organization_id;

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization', orgId],
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
  } = useForm<EmpresaFormValues>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      name: '',
      tax_id: '',
      currency: 'COP',
      locale: 'es-CO',
      timezone: 'America/Bogota',
      date_format: 'dd/MM/yyyy',
      default_check_in_time: '15:00',
      default_check_out_time: '12:00',
      tax_rate: 0,
    },
  });

  useEffect(() => {
    if (org) {
      reset({
        name: org.name,
        tax_id: org.tax_id ?? '',
        currency: org.currency,
        locale: org.locale,
        timezone: org.timezone,
        date_format: org.date_format,
        default_check_in_time: org.default_check_in_time,
        default_check_out_time: org.default_check_out_time,
        tax_rate: org.tax_rate,
      });
    }
  }, [org, reset]);

  const mutation = useMutation({
    mutationFn: async (values: EmpresaFormValues) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('organizations')
        .update({
          name: values.name,
          tax_id: values.tax_id || null,
          currency: values.currency,
          locale: values.locale,
          timezone: values.timezone,
          date_format: values.date_format,
          default_check_in_time: values.default_check_in_time,
          default_check_out_time: values.default_check_out_time,
          tax_rate: values.tax_rate,
        })
        .eq('id', orgId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configuración guardada');
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => {
      logSupabaseError(error, 'organizations:empresa');
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  const onSubmit = (values: EmpresaFormValues) => mutation.mutate(values);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresa</h1>
          <p className="text-sm text-muted-foreground">
            Datos del hotel, moneda y configuración regional
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
          {/* Logo placeholder */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold">Logo del hotel</h2>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed bg-muted text-muted-foreground">
                <Building2 className="h-8 w-8" />
              </div>
              <div className="space-y-1.5">
                <Button type="button" variant="outline" size="sm" disabled>
                  <Upload className="mr-1.5 h-4 w-4" />
                  Subir logo
                </Button>
                <p className="text-xs text-muted-foreground">
                  Próximamente — almacenamiento en Supabase Storage
                </p>
              </div>
            </div>
          </div>

          {/* Identity */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Identidad</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre del hotel *</Label>
                <Input id="name" {...register('name')} />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tax_id">NIT / RUT</Label>
                <Input id="tax_id" placeholder="900.000.000-1" {...register('tax_id')} />
              </div>
            </div>
          </div>

          {/* Currency & locale */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Moneda y región</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select
                  value={watch('currency') ?? 'COP'}
                  onValueChange={(v) => setValue('currency', v ?? 'COP', { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Idioma / Locale</Label>
                <Select
                  value={watch('locale') ?? 'es-CO'}
                  onValueChange={(v) => setValue('locale', v ?? 'es-CO', { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Zona horaria</Label>
                <Select
                  value={watch('timezone') ?? 'America/Bogota'}
                  onValueChange={(v) => setValue('timezone', v ?? 'America/Bogota', { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Formato de fecha</Label>
                <Select
                  value={watch('date_format') ?? 'dd/MM/yyyy'}
                  onValueChange={(v) => setValue('date_format', v ?? 'dd/MM/yyyy', { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Hotel defaults */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Valores por defecto</h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="default_check_in_time">Hora check-in</Label>
                <Input
                  id="default_check_in_time"
                  type="time"
                  {...register('default_check_in_time')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="default_check_out_time">Hora check-out</Label>
                <Input
                  id="default_check_out_time"
                  type="time"
                  {...register('default_check_out_time')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tax_rate">IVA / Impuesto (%)</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  {...register('tax_rate')}
                />
                {errors.tax_rate && (
                  <p className="text-xs text-destructive">{errors.tax_rate.message}</p>
                )}
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
