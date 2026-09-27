'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Palette, Upload, Loader2 } from 'lucide-react';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/use-profile';

// -------------------------------------------------------
// Preset palette
// -------------------------------------------------------

const PRESET_COLORS = [
  { label: 'POSTY 500', value: '#9c0b21' },
  { label: 'POSTY 600', value: '#82091b' },
  { label: 'POSTY 700', value: '#690717' },
  { label: 'POSTY 400', value: '#be1d35' },
  { label: 'POSTY 200', value: '#f8b4bc' },
  { label: 'Índigo',    value: '#4f46e5' },
  { label: 'Azul',     value: '#2563eb' },
  { label: 'Cian',     value: '#0891b2' },
  { label: 'Verde',    value: '#16a34a' },
  { label: 'Esmeralda',value: '#059669' },
  { label: 'Ámbar',    value: '#d97706' },
  { label: 'Gris',     value: '#4b5563' },
];

// -------------------------------------------------------
// Fetch organization
// -------------------------------------------------------

async function fetchOrgBrand(orgId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, brand_color, logo_url')
    .eq('id', orgId)
    .single();
  if (error) throw error;
  return data;
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function MarcaPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const orgId = profile?.organization_id;

  const { data: org, isLoading } = useQuery({
    queryKey: ['org_brand', orgId],
    queryFn: () => fetchOrgBrand(orgId!),
    enabled: !!orgId,
  });

  const [color, setColor] = useState('#4f46e5');

  useEffect(() => {
    if (org?.brand_color) {
      setColor(org.brand_color);
    }
  }, [org]);

  const mutation = useMutation({
    mutationFn: async (brandColor: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('organizations')
        .update({ brand_color: brandColor })
        .eq('id', orgId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Color de marca actualizado');
      queryClient.invalidateQueries({ queryKey: ['org_brand', orgId] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => {
      logSupabaseError(error, 'organizations:brand_color');
      toast.error(getSupabaseErrorMessage(error));
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Palette className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marca y apariencia</h1>
          <p className="text-sm text-muted-foreground">
            Personaliza el color y logo de tu hotel
          </p>
        </div>
      </div>

      {/* Logo */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold">Logo</h2>
        <div className="flex items-center gap-4">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed"
            style={{ borderColor: color }}
          >
            {org?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logo_url}
                alt="Logo"
                className="h-full w-full rounded-xl object-contain"
              />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-1.5">
            <Button type="button" variant="outline" size="sm" disabled>
              <Upload className="mr-1.5 h-4 w-4" />
              Subir logo
            </Button>
            <p className="text-xs text-muted-foreground">
              Próximamente — requiere Supabase Storage
            </p>
          </div>
        </div>
      </div>

      {/* Brand color */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Color de marca</h2>

        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : (
          <>
            {/* Palette presets */}
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  onClick={() => setColor(preset.value)}
                  className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    color === preset.value
                      ? 'border-foreground scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: preset.value }}
                />
              ))}
            </div>

            {/* Custom input */}
            <div className="flex items-center gap-3">
              <Label htmlFor="brand-color-input">Color personalizado</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded border bg-transparent p-0.5"
                  aria-label="Seleccionar color"
                />
                <Input
                  id="brand-color-input"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#4f46e5"
                  className="w-32 font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Save button */}
            <Button
              onClick={() => mutation.mutate(color)}
              disabled={mutation.isPending}
              className="mt-2"
              style={{ backgroundColor: color, borderColor: color }}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar color
            </Button>
          </>
        )}
      </div>

      {/* Preview */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold">Vista previa</h2>
        <div
          className="rounded-xl p-5 text-white space-y-2"
          style={{ backgroundColor: color }}
        >
          <p className="font-bold text-lg">{org?.name ?? 'Mi Hotel'}</p>
          <p className="text-sm opacity-80">Sistema de gestión hotelera POSTY</p>
          <div className="flex gap-2 pt-1">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
              Color primario
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-mono">
              {color}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Este color se aplica a elementos de acento en toda la aplicación.
        </p>
      </div>
    </div>
  );
}
