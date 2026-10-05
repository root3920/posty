'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Building2,
  BedDouble,
  Users,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Loader2,
  SkipForward,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// eslint-disable-next-line no-restricted-imports -- Wizard needs custom fullscreen dialog, not ResponsiveDialog
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { TimeSelect } from '@/components/shared/time-select';
import { RoomNumberInput } from '@/components/hotel/room-number-input';
import { useProfile } from '@/hooks/use-profile';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useAllRooms } from '@/hooks/use-hotel';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ParsedRoom } from '@/lib/room-number-parser';

// -------------------------------------------------------
// Wizard steps config
// -------------------------------------------------------

const STEPS = [
  { id: 'welcome', icon: Sparkles, label: 'Bienvenida' },
  { id: 'hotel', icon: Building2, label: 'Tu hotel' },
  { id: 'rooms', icon: BedDouble, label: 'Habitaciones' },
  { id: 'team', icon: Users, label: 'Equipo' },
] as const;

// -------------------------------------------------------
// Main Component
// -------------------------------------------------------

export function WelcomeWizard() {
  const { data: profile } = useProfile();
  const { isWizardSeen, markWizardSeen, isLoading } = useOnboarding();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [step, setStep] = useState(0);

  // Step 2: Hotel data
  const [hotelName, setHotelName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [taxRate, setTaxRate] = useState('19');
  const [checkInTime, setCheckInTime] = useState('15:00');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [hotelSaved, setHotelSaved] = useState(false);

  // Step 3: Room type + rooms
  const [rtName, setRtName] = useState('');
  const [rtRate, setRtRate] = useState('');
  const [rtMaxAdults, setRtMaxAdults] = useState(2);
  const [roomsInput, setRoomsInput] = useState('');
  const [parsedRooms, setParsedRooms] = useState<ParsedRoom[]>([]);
  const [roomsSaved, setRoomsSaved] = useState(false);

  // Step 4: Invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');

  const { data: existingRooms = [] } = useAllRooms();
  const existingNumbers = new Set(existingRooms.map((r) => r.number));

  const orgId = profile?.organization_id;
  const currency = profile?.organization?.currency ?? 'COP';
  const locale = profile?.organization?.locale ?? 'es-CO';

  // Init hotel name from profile
  if (!hotelName && profile?.organization?.name) {
    setHotelName(profile.organization.name);
  }

  // ---- Mutations ----

  const saveHotel = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from('organizations')
        .update({
          name: hotelName.trim(),
          tax_id: taxId.trim() || null,
          tax_rate: parseFloat(taxRate) || 19,
          default_check_in_time: checkInTime,
          default_check_out_time: checkOutTime,
        })
        .eq('id', orgId!);
      if (error) throw error;
    },
    onSuccess: () => {
      setHotelSaved(true);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Datos del hotel guardados');
    },
    onError: () => toast.error('Error al guardar los datos'),
  });

  const saveRooms = useMutation({
    mutationFn: async () => {
      if (!rtName.trim() || !rtRate || parsedRooms.length === 0) {
        throw new Error('Completa todos los campos');
      }
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('create_room_type_with_rooms', {
        p_name: rtName.trim(),
        p_code: null,
        p_description: null,
        p_base_rate: parseFloat(rtRate),
        p_max_adults: rtMaxAdults,
        p_max_children: 0,
        p_amenities: [],
        p_bed_config: '[]',
        p_size_sqm: null,
        p_photo_paths: [],
        p_rooms: JSON.stringify(parsedRooms.map((r) => ({
          number: r.number,
          floor: r.floor,
          rate_override: null,
        }))),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setRoomsSaved(true);
      queryClient.invalidateQueries({ queryKey: ['room_types'] });
      queryClient.invalidateQueries({ queryKey: ['hotel_all_rooms'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding_counts'] });
      toast.success(`${rtName} creado con ${parsedRooms.length} habitaciones`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al crear habitaciones'),
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
      if (!inviteEmail.trim() || !inviteName.trim()) {
        throw new Error('Ingresa nombre y correo');
      }
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          fullName: inviteName.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al enviar invitación');
      }
    },
    onSuccess: () => {
      toast.success(`Invitación enviada a ${inviteEmail}`);
      setInviteEmail('');
      setInviteName('');
      queryClient.invalidateQueries({ queryKey: ['onboarding_counts'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error'),
  });

  // ---- Navigation ----

  function handleFinish() {
    markWizardSeen();
    router.push('/dashboard');
  }

  function handleClose() {
    markWizardSeen();
  }

  // Don't show if: loading, already seen, not Gestor, no profile
  if (isLoading || isWizardSeen || !profile) return null;

  const isOpen = !isWizardSeen;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        showCloseButton
        className="w-[94vw] sm:max-w-[600px] gap-0 overflow-hidden p-0"
      >
        {/* Stepper */}
        <div className="flex items-center justify-center gap-1 border-b px-4 py-3 sm:gap-2">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center">
                {i > 0 && (
                  <div className={cn('h-0.5 w-4 sm:w-8', done ? 'bg-emerald-500' : 'bg-border')} />
                )}
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      done ? 'bg-emerald-500 text-white' : current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={cn('hidden text-[10px] sm:block', current ? 'font-medium' : 'text-muted-foreground')}>
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="min-h-[320px] overflow-y-auto px-6 py-5">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-heading text-xl font-semibold">
                ¡Bienvenido a POSTY!
              </h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Vamos a configurar tu hotel en unos minutos. Puedes cerrar este asistente y retomarlo cuando quieras.
              </p>
            </div>
          )}

          {/* Step 1: Hotel data */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-heading text-lg font-semibold">Datos de tu hotel</h2>
                <p className="text-xs text-muted-foreground">Estos datos se usan para facturación e impuestos</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre del hotel *</Label>
                  <Input value={hotelName} onChange={(e) => setHotelName(e.target.value)} placeholder="Hotel Boutique" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">NIT / ID fiscal</Label>
                    <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="900.123.456-7" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">IVA (%)</Label>
                    <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} min={0} max={100} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Hora de check-in</Label>
                    <TimeSelect value={checkInTime} onChange={setCheckInTime} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hora de check-out</Label>
                    <TimeSelect value={checkOutTime} onChange={setCheckOutTime} />
                  </div>
                </div>
              </div>

              {hotelSaved && (
                <p className="flex items-center gap-1 text-xs text-emerald-600">
                  <Check className="h-3.5 w-3.5" /> Guardado
                </p>
              )}
            </div>
          )}

          {/* Step 2: Room type + rooms */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-heading text-lg font-semibold">Tipo de habitación y habitaciones</h2>
                <p className="text-xs text-muted-foreground">Crea un tipo (ej. &ldquo;Estándar&rdquo;) y sus habitaciones. Puedes agregar más tipos después.</p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre del tipo *</Label>
                    <Input value={rtName} onChange={(e) => setRtName(e.target.value)} placeholder="Estándar" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tarifa por noche *</Label>
                    <Input
                      type="number"
                      value={rtRate}
                      onChange={(e) => setRtRate(e.target.value)}
                      placeholder={formatCurrency(150000, currency, locale)}
                      min={0}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Máximo de adultos</Label>
                  <Input type="number" value={rtMaxAdults} onChange={(e) => setRtMaxAdults(Number(e.target.value))} min={1} max={20} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Números de habitación *</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Escribe los números separados por comas o un rango (ej. 101-110, 201-205)
                  </p>
                  <RoomNumberInput
                    value={roomsInput}
                    onChange={setRoomsInput}
                    existingNumbers={existingNumbers}
                    parsedRooms={parsedRooms}
                    onParsedChange={setParsedRooms}
                  />
                </div>
              </div>

              {roomsSaved && (
                <p className="flex items-center gap-1 text-xs text-emerald-600">
                  <Check className="h-3.5 w-3.5" /> {rtName} creado con {parsedRooms.length} habitaciones
                </p>
              )}
            </div>
          )}

          {/* Step 3: Invite team */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-heading text-lg font-semibold">Invita a tu equipo</h2>
                <p className="text-xs text-muted-foreground">
                  Opcional — tu equipo podrá acceder a POSTY con su propio usuario. Puedes invitar más personas después.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre completo</Label>
                  <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="María García" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Correo electrónico</Label>
                  <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="maria@hotel.com" />
                </div>
              </div>

              {inviteEmail && inviteName && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendInvite.mutate()}
                  disabled={sendInvite.isPending}
                >
                  {sendInvite.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Enviar invitación
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-3">
          <div>
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Anterior
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 1 && !hotelSaved && (
              <Button
                size="sm"
                onClick={() => saveHotel.mutate()}
                disabled={!hotelName.trim() || saveHotel.isPending}
              >
                {saveHotel.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Guardar
              </Button>
            )}

            {step === 2 && !roomsSaved && (
              <Button
                size="sm"
                onClick={() => saveRooms.mutate()}
                disabled={!rtName.trim() || !rtRate || parsedRooms.length === 0 || saveRooms.isPending}
              >
                {saveRooms.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Crear habitaciones
              </Button>
            )}

            {step < STEPS.length - 1 ? (
              <Button
                size="sm"
                variant={step === 0 ? 'default' : 'outline'}
                onClick={() => {
                  // Auto-save hotel data if not saved yet
                  if (step === 1 && !hotelSaved && hotelName.trim()) {
                    saveHotel.mutate();
                  }
                  setStep(step + 1);
                }}
              >
                {step === 0 ? 'Empezar' : 'Siguiente'}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleFinish}>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Finalizar
              </Button>
            )}

            {step > 0 && step < STEPS.length - 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setStep(step + 1)}
              >
                <SkipForward className="mr-1 h-3 w-3" />
                Omitir
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
