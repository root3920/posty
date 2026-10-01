'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Shield } from 'lucide-react';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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

const regulatorioSchema = z.object({
  rnt_number: z.string().min(1, 'El número RNT es obligatorio'),
  rnt_category: z.string().min(1, 'Selecciona una categoría'),
  sire_enabled: z.boolean(),
  address: z.string().optional(),
  city: z.string().optional(),
  department: z.string().optional(),
});

type RegulatorioFormValues = z.infer<typeof regulatorioSchema>;

// -------------------------------------------------------
// Options
// -------------------------------------------------------

const RNT_CATEGORIES = [
  { value: 'alojamiento', label: 'Establecimiento de alojamiento y hospedaje' },
  { value: 'agencia_viajes', label: 'Agencia de viajes' },
  { value: 'guia_turismo', label: 'Guía de turismo' },
  { value: 'operador_congreso', label: 'Operador profesional de congresos y ferias' },
  { value: 'arrendador_vehiculos', label: 'Arrendador de vehículos' },
  { value: 'empresa_transporte', label: 'Empresa de transporte turístico' },
  { value: 'otro', label: 'Otro prestador de servicios turísticos' },
];

const DEPARTMENTS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá',
  'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba',
  'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena',
  'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
  'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Vaupés', 'Vichada',
];

// -------------------------------------------------------
// Fetch organization
// -------------------------------------------------------

async function fetchOrganization(orgId: string) {
  const supabase = createClient();
  const { data, error } = await (supabase as any)
    .from('organizations')
    .select('id, rnt_number, rnt_category, sire_enabled, address, city, department')
    .eq('id', orgId)
    .single();
  if (error) throw error;
  return data as {
    id: string;
    rnt_number: string | null;
    rnt_category: string | null;
    sire_enabled: boolean | null;
    address: string | null;
    city: string | null;
    department: string | null;
  };
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function RegulatorioPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const orgId = profile?.organization_id;

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization_regulatorio', orgId],
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
  } = useForm<RegulatorioFormValues>({
    resolver: zodResolver(regulatorioSchema),
    defaultValues: {
      rnt_number: '',
      rnt_category: 'alojamiento',
      sire_enabled: false,
      address: '',
      city: '',
      department: '',
    },
  });

  useEffect(() => {
    if (org) {
      reset({
        rnt_number: org.rnt_number ?? '',
        rnt_category: org.rnt_category ?? 'alojamiento',
        sire_enabled: org.sire_enabled ?? false,
        address: org.address ?? '',
        city: org.city ?? '',
        department: org.department ?? '',
      });
    }
  }, [org, reset]);

  const mutation = useMutation({
    mutationFn: async (values: RegulatorioFormValues) => {
      const supabase = createClient();
      const { error } = await (supabase as any)
        .from('organizations')
        .update({
          rnt_number: values.rnt_number || null,
          rnt_category: values.rnt_category || null,
          sire_enabled: values.sire_enabled,
          address: values.address || null,
          city: values.city || null,
          department: values.department || null,
        })
        .eq('id', orgId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configuración regulatoria guardada');
      queryClient.invalidateQueries({ queryKey: ['organization_regulatorio', orgId] });
    },
    onError: (error) => {
      logSupabaseError(error, 'organizations:regulatorio');
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  const onSubmit = (values: RegulatorioFormValues) => mutation.mutate(values);

  const sireEnabled = watch('sire_enabled');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración regulatoria</h1>
          <p className="text-sm text-muted-foreground">
            RNT, TRA y SIRE — Cumplimiento regulatorio colombiano
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">

          {/* RNT */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Registro Nacional de Turismo (RNT)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Número asignado por el Ministerio de Comercio, Industria y Turismo (MinCIT)
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rnt_number">Número RNT *</Label>
                <Input
                  id="rnt_number"
                  placeholder="ej. 12345"
                  {...register('rnt_number')}
                />
                {errors.rnt_number && (
                  <p className="text-xs text-destructive">{errors.rnt_number.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Categoría RNT *</Label>
                <Select
                  value={watch('rnt_category') ?? 'alojamiento'}
                  onValueChange={(v) => setValue('rnt_category', v ?? 'alojamiento', { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RNT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.rnt_category && (
                  <p className="text-xs text-destructive">{errors.rnt_category.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Ubicación */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Ubicación del establecimiento</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Usada en los reportes TRA y SIRE enviados a las autoridades
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                placeholder="Calle 10 # 5-23"
                {...register('address')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="city">Municipio / Ciudad</Label>
                <Input
                  id="city"
                  placeholder="Bogotá"
                  {...register('city')}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Departamento</Label>
                <Select
                  value={watch('department') ?? ''}
                  onValueChange={(v) => setValue('department', v ?? '', { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* TRA */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div>
              <h2 className="text-sm font-semibold">TRA — Tarjeta de Registro de Alojamiento</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reporte de viajeros hospedados exigido por el MinCIT. Se envía vía API al registrar cada check-in.
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              La TRA se genera automáticamente al confirmar la llegada de un huésped si el RNT está configurado.
              También puedes enviarla manualmente desde la ficha de cada reserva.
            </div>
          </div>

          {/* SIRE */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">SIRE — Sistema de Información de Registro de Extranjeros</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reporte de huéspedes extranjeros exigido por Migración Colombia.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="sire_enabled"
                checked={sireEnabled}
                onCheckedChange={(checked) =>
                  setValue('sire_enabled', checked === true, { shouldValidate: true })
                }
              />
              <Label htmlFor="sire_enabled" className="cursor-pointer">
                Habilitar generación automática de registros SIRE al hacer check-in de huéspedes extranjeros
              </Label>
            </div>

            {sireEnabled && (
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                SIRE activo: los check-ins de huéspedes con nacionalidad diferente a Colombia generarán
                un registro SIRE automáticamente. Puedes exportar el archivo de texto desde la
                sección Regulatorio del módulo Finanzas.
              </div>
            )}
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
