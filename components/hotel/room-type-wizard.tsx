'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, BedDouble, Camera, Hash } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { RoomNumberInput } from '@/components/hotel/room-number-input';
import { useProfile } from '@/hooks/use-profile';
import { useAllRooms } from '@/hooks/use-hotel';
import { formatCurrency } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { getSupabaseErrorMessage, logSupabaseError } from '@/lib/supabase/errors';
import type { ParsedRoom } from '@/lib/room-number-parser';

// -------------------------------------------------------
// Amenities presets
// -------------------------------------------------------

const AMENITY_PRESETS = [
  'WiFi', 'TV', 'Aire acondicionado', 'Minibar', 'Caja fuerte',
  'Balcón', 'Vista al mar', 'Bañera', 'Escritorio', 'Cafetera',
  'Secador de pelo', 'Plancha', 'Teléfono', 'Frigobar',
];

const BED_TYPES = [
  { key: 'king', label: '1 King' },
  { key: 'queen', label: '1 Queen' },
  { key: 'double', label: '1 Doble' },
  { key: 'twin', label: '2 Sencillas' },
  { key: 'sofa_bed', label: 'Sofá cama' },
];

// -------------------------------------------------------
// Steps
// -------------------------------------------------------

const STEPS = [
  { number: 1, label: 'Tipo', icon: BedDouble },
  { number: 2, label: 'Fotos', icon: Camera },
  { number: 3, label: 'Habitaciones', icon: Hash },
];

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface RoomTypeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function RoomTypeWizard({ open, onOpenChange }: RoomTypeWizardProps) {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const currency = profile?.organization?.currency ?? 'COP';
  const locale = profile?.organization?.locale ?? 'es-CO';
  const { data: existingRooms = [] } = useAllRooms();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Type data
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [maxAdults, setMaxAdults] = useState(2);
  const [maxChildren, setMaxChildren] = useState(0);
  const [baseRate, setBaseRate] = useState(0);
  const [sizeSqm, setSizeSqm] = useState('');
  const [selectedBeds, setSelectedBeds] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [newAmenity, setNewAmenity] = useState('');

  // Step 3: Rooms
  const [roomInput, setRoomInput] = useState('');
  const [parsedRooms, setParsedRooms] = useState<ParsedRoom[]>([]);

  // Existing room numbers for validation
  const existingNumbers = useMemo(
    () => new Set(existingRooms.map((r) => r.number)),
    [existingRooms],
  );

  // Auto-suggest code from name
  function handleNameChange(val: string) {
    setName(val);
    if (!code || code === suggestCode(name)) {
      setCode(suggestCode(val));
    }
  }

  function suggestCode(n: string): string {
    return n
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 4);
  }

  function toggleAmenity(a: string) {
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  }

  function addCustomAmenity() {
    const trimmed = newAmenity.trim();
    if (trimmed && !amenities.includes(trimmed)) {
      setAmenities([...amenities, trimmed]);
    }
    setNewAmenity('');
  }

  function toggleBed(key: string) {
    setSelectedBeds((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  // Validation
  const step1Valid = name.trim().length > 0 && baseRate > 0;
  const step3Valid = parsedRooms.length > 0;

  async function handleCreate() {
    if (!step1Valid || !step3Valid) return;

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const bedConfig = selectedBeds.map((key) => {
        const bed = BED_TYPES.find((b) => b.key === key);
        return { type: key, label: bed?.label ?? key };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('create_room_type_with_rooms', {
        p_name: name.trim(),
        p_code: code.trim() || null,
        p_description: description.trim() || null,
        p_base_rate: baseRate,
        p_max_adults: maxAdults,
        p_max_children: maxChildren,
        p_amenities: amenities,
        p_bed_config: JSON.stringify(bedConfig),
        p_size_sqm: sizeSqm ? parseFloat(sizeSqm) : null,
        p_photo_paths: [],
        p_rooms: JSON.stringify(parsedRooms.map((r) => ({
          number: r.number,
          floor: r.floor,
          rate_override: r.rateOverride ?? null,
        }))),
      });

      if (error) {
        logSupabaseError(error, 'createRoomTypeWithRooms');
        toast.error(getSupabaseErrorMessage(error));
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = data as any;
        toast.success(`${name} creado con ${result?.room_count ?? parsedRooms.length} habitaciones`);
        queryClient.invalidateQueries({ queryKey: ['hotel_rooms'] });
        queryClient.invalidateQueries({ queryKey: ['hotel_all_rooms'] });
        queryClient.invalidateQueries({ queryKey: ['hotel_kpis'] });
        queryClient.invalidateQueries({ queryKey: ['room_types'] });
        queryClient.invalidateQueries({ queryKey: ['catalog', 'room_types'] });
        resetForm();
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Create room type error:', err);
      toast.error('Error inesperado al crear el tipo de habitación');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setStep(1);
    setName('');
    setCode('');
    setDescription('');
    setMaxAdults(2);
    setMaxChildren(0);
    setBaseRate(0);
    setSizeSqm('');
    setSelectedBeds([]);
    setAmenities([]);
    setRoomInput('');
    setParsedRooms([]);
  }

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
      <div>
        {step > 1 && (
          <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
            Anterior
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        {step < 3 ? (
          <Button
            type="button"
            disabled={step === 1 && !step1Valid}
            onClick={() => setStep(step + 1)}
          >
            Siguiente
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!step3Valid || isSubmitting}
            onClick={handleCreate}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Crear (${parsedRooms.length} hab.)`}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Agregar tipo de habitación"
      size="lg"
      footer={footer}
    >
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 pb-4">
        {STEPS.map((s, i) => {
          const done = s.number < step;
          const current = s.number === step;
          return (
            <div key={s.number} className="flex items-center">
              {i > 0 && <div className={`h-0.5 w-6 ${done ? 'bg-emerald-500' : 'bg-border'}`} />}
              <div className="flex flex-col items-center gap-0.5">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  done ? 'bg-emerald-500 text-white' : current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : s.number}
                </div>
                <span className={`text-[10px] ${current ? 'font-medium' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 1: Type */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Nombre *</Label>
              <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Twin Confort" />
            </div>
            <div>
              <Label className="text-xs">Código corto</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TC" maxLength={4} />
            </div>
            <div>
              <Label className="text-xs">Tamaño (m²)</Label>
              <Input value={sizeSqm} onChange={(e) => setSizeSqm(e.target.value)} placeholder="24" type="number" step="0.1" min="0" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Habitación con vista al jardín..." />
          </div>

          {/* Capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Máx. adultos *</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setMaxAdults(Math.max(1, maxAdults - 1))}>−</Button>
                <span className="w-8 text-center font-bold">{maxAdults}</span>
                <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setMaxAdults(Math.min(20, maxAdults + 1))}>+</Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Máx. niños</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setMaxChildren(Math.max(0, maxChildren - 1))}>−</Button>
                <span className="w-8 text-center font-bold">{maxChildren}</span>
                <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setMaxChildren(Math.min(20, maxChildren + 1))}>+</Button>
              </div>
            </div>
          </div>

          {/* Beds */}
          <div>
            <Label className="text-xs">Camas</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {BED_TYPES.map((bed) => (
                <button
                  key={bed.key}
                  type="button"
                  onClick={() => toggleBed(bed.key)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedBeds.includes(bed.key)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {bed.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amenities */}
          <div>
            <Label className="text-xs">Amenidades</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {AMENITY_PRESETS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    amenities.includes(a)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                placeholder="Agregar otra..."
                className="text-xs"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomAmenity(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomAmenity} className="shrink-0 text-xs">
                Agregar
              </Button>
            </div>
            {amenities.filter((a) => !AMENITY_PRESETS.includes(a)).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {amenities.filter((a) => !AMENITY_PRESETS.includes(a)).map((a) => (
                  <Badge key={a} variant="secondary" className="text-[10px] gap-1 pr-1">
                    {a}
                    <button type="button" onClick={() => toggleAmenity(a)} className="rounded-full p-0.5 hover:bg-muted-foreground/20">×</button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Rate */}
          <div>
            <Label className="text-xs">Tarifa por noche *</Label>
            <Input
              type="number"
              step="1000"
              min="0"
              value={baseRate || ''}
              onChange={(e) => setBaseRate(parseFloat(e.target.value) || 0)}
              placeholder="150000"
            />
            {baseRate > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatCurrency(baseRate, currency, locale)} por noche
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Photos (skip-able) */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 text-center">
            <Camera className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Arrastra fotos aquí o toca para seleccionar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Máx. 10 fotos · 8 MB cada una · Se optimizan automáticamente
            </p>
            <p className="text-xs text-muted-foreground mt-4 italic">
              Las fotos estarán disponibles pronto. Por ahora, puedes saltar este paso.
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Rooms */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">
              ¿Qué números tienen las habitaciones de tipo &quot;{name}&quot;?
            </h3>
          </div>

          <RoomNumberInput
            value={roomInput}
            onChange={setRoomInput}
            existingNumbers={existingNumbers}
            parsedRooms={parsedRooms}
            onParsedChange={setParsedRooms}
          />

          {parsedRooms.length > 0 && baseRate > 0 && (
            <p className="text-xs text-muted-foreground">
              Cada habitación tendrá la tarifa de {formatCurrency(baseRate, currency, locale)} por defecto.
            </p>
          )}
        </div>
      )}
    </ResponsiveDialog>
  );
}
