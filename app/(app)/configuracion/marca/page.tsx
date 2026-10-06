'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Palette, Loader2, RotateCcw } from 'lucide-react';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/use-profile';
import { LogoUploadCard } from '@/components/settings/logo-upload-card';
import {
  generateBrandPalette,
  bestForeground,
  isLightOnDark,
  validateHex,
  POSTY_DEFAULT_COLOR,
  contrastRatio,
} from '@/lib/brand-colors';

// -------------------------------------------------------
// Preset palette
// -------------------------------------------------------

const PRESET_COLORS = [
  { label: 'POSTY (rojo)',  value: '#9c0b21' },
  { label: 'Índigo',       value: '#4f46e5' },
  { label: 'Azul',         value: '#2563eb' },
  { label: 'Cian',         value: '#0891b2' },
  { label: 'Verde',        value: '#16a34a' },
  { label: 'Esmeralda',    value: '#059669' },
  { label: 'Ámbar',        value: '#d97706' },
  { label: 'Rosa',         value: '#db2777' },
  { label: 'Violeta',      value: '#7c3aed' },
  { label: 'Gris',         value: '#4b5563' },
  { label: 'Negro',        value: '#1f2937' },
  { label: 'Marrón',       value: '#92400e' },
];

// -------------------------------------------------------
// Fetch organization
// -------------------------------------------------------

async function fetchOrgBrand(orgId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('name, brand_color, logo_url')
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

  const initialColor = org?.brand_color ?? POSTY_DEFAULT_COLOR;
  const [color, setColor] = useState(initialColor);
  const [hexInput, setHexInput] = useState(initialColor);

  // Sync when org data loads (only on first load)
  const [synced, setSynced] = useState(false);
  if (org?.brand_color && !synced) {
    setSynced(true);
    if (color === POSTY_DEFAULT_COLOR && org.brand_color !== POSTY_DEFAULT_COLOR) {
      setColor(org.brand_color);
      setHexInput(org.brand_color);
    }
  }

  const palette = useMemo(() => generateBrandPalette(color), [color]);
  const fg = bestForeground(color);
  const isDark = isLightOnDark(color);
  const whiteContrast = contrastRatio(color, '#ffffff');
  const isLowContrast = whiteContrast < 3;

  function handleColorChange(hex: string) {
    setColor(hex);
    setHexInput(hex);
  }

  function handleHexInput(value: string) {
    setHexInput(value);
    const valid = validateHex(value);
    if (valid) setColor(valid);
  }

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
          <h1 className="font-heading text-2xl font-bold tracking-tight">Marca y apariencia</h1>
          <p className="text-sm text-muted-foreground">
            Personaliza el color y logo de tu hotel
          </p>
        </div>
      </div>

      {/* Logo */}
      <LogoUploadCard currentLogoUrl={profile?.organization?.logo_url ?? null} />

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
                  onClick={() => handleColorChange(preset.value)}
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
              <Label htmlFor="brand-color-input">Personalizado</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded border bg-transparent p-0.5"
                  aria-label="Seleccionar color"
                />
                <Input
                  id="brand-color-input"
                  value={hexInput}
                  onChange={(e) => handleHexInput(e.target.value)}
                  placeholder="#4f46e5"
                  className="w-32 font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Contrast warning */}
            {isLowContrast && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Este color es muy claro: usaremos texto oscuro encima para que se lea bien.
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={() => mutation.mutate(color)}
                disabled={mutation.isPending}
                style={{ backgroundColor: color, borderColor: color, color: fg }}
              >
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar color
              </Button>
              {color !== POSTY_DEFAULT_COLOR && (
                <Button
                  variant="outline"
                  onClick={() => {
                    handleColorChange(POSTY_DEFAULT_COLOR);
                    mutation.mutate(POSTY_DEFAULT_COLOR);
                  }}
                  disabled={mutation.isPending}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Restablecer POSTY
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Live preview */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold">Vista previa</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Mini sidebar */}
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: `linear-gradient(180deg, ${color} 0%, ${palette['--sidebar-darker']} 100%)` }}
          >
            <p className="text-xs font-bold" style={{ color: fg }}>MENÚ LATERAL</p>
            <div className="space-y-1">
              {['Dashboard', 'Hotel', 'Tareas'].map((item, i) => (
                <div
                  key={item}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium"
                  style={i === 1 ? {
                    backgroundColor: isDark ? '#ffffff' : '#0f0c0d',
                    color: color,
                  } : {
                    color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)',
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* UI elements */}
          <div className="space-y-3">
            {/* Button */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">BOTÓN</p>
              <button
                className="rounded-[10px] px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: color, color: fg }}
              >
                Guardar cambios
              </button>
            </div>

            {/* Tabs */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">PESTAÑA ACTIVA</p>
              <div className="flex gap-1">
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: color, color: fg }}
                >
                  Activa
                </span>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  Inactiva
                </span>
              </div>
            </div>

            {/* Chat bubble */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">BURBUJA DE CHAT</p>
              <div
                className="inline-block rounded-2xl rounded-br-sm px-3 py-1.5 text-xs"
                style={{ backgroundColor: color, color: fg }}
              >
                Hola, bienvenido al hotel
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          El color se aplica al menú lateral, botones, pestañas activas, burbujas de chat y más.
          Los colores de error, éxito y advertencia no cambian.
        </p>
      </div>
    </div>
  );
}
