'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  CheckCircle2,
  MessageCircle,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Wifi,
} from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/page-header';
import { useWhatsAppConnection } from '@/hooks/use-chat';
import { cn } from '@/lib/utils';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

type AccountType = 'business' | 'personal';
type Step = 1 | 2 | 3;

// -------------------------------------------------------
// Step 1 — Choose account type
// -------------------------------------------------------

interface Step1Props {
  accountType: AccountType | null;
  onSelectType: (type: AccountType) => void;
  understood: boolean;
  onUnderstoodChange: (v: boolean) => void;
  onContinue: () => void;
}

function Step1({
  accountType,
  onSelectType,
  understood,
  onUnderstoodChange,
  onContinue,
}: Step1Props) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Selecciona el tipo de cuenta de WhatsApp que deseas vincular.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Business */}
        <button
          type="button"
          onClick={() => onSelectType('business')}
          className={cn(
            'flex flex-col gap-3 rounded-xl border-2 p-5 text-left transition-all',
            accountType === 'business'
              ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
              : 'border-border hover:border-muted-foreground/40',
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'rounded-lg p-2',
                accountType === 'business'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">WhatsApp Business</p>
              <span className="text-xs font-medium text-green-600">Recomendado</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Perfil de empresa, mensajes automatizados, etiquetas y más funciones para negocios.
          </p>
        </button>

        {/* Personal */}
        <button
          type="button"
          onClick={() => onSelectType('personal')}
          className={cn(
            'flex flex-col gap-3 rounded-xl border-2 p-5 text-left transition-all',
            accountType === 'personal'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/40',
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'rounded-lg p-2',
                accountType === 'personal'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <Smartphone className="h-5 w-5" />
            </div>
            <p className="font-medium text-foreground">WhatsApp Personal</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Cuenta personal. Funciona igual, pero sin funciones exclusivas de empresa.
          </p>
        </button>
      </div>

      {/* Warning for personal */}
      {accountType === 'personal' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <strong>Aviso:</strong> Al vincular una cuenta personal, tus conversaciones personales
          también pueden aparecer en la bandeja de entrada del hotel.
        </div>
      )}

      {/* Confirmation checkbox */}
      {accountType && (
        <div className="flex items-start gap-3 rounded-lg border p-4">
          <Checkbox
            id="understood"
            checked={understood}
            onCheckedChange={(v) => onUnderstoodChange(Boolean(v))}
            className="mt-0.5"
          />
          <Label htmlFor="understood" className="cursor-pointer text-sm leading-snug">
            Entiendo que esta conexión usa WhatsApp Web y que el teléfono debe permanecer conectado
            a Internet para recibir mensajes.
          </Label>
        </div>
      )}

      <Button
        className="w-full"
        disabled={!accountType || !understood}
        onClick={onContinue}
      >
        Continuar
      </Button>
    </div>
  );
}

// -------------------------------------------------------
// Step 2 — Scan QR
// -------------------------------------------------------

interface QrData {
  qr: string | null;
  connected: boolean;
  status: string;
}

interface Step2Props {
  accountType: AccountType;
  onConnected: () => void;
}

function Step2({ accountType, onConnected }: Step2Props) {
  const [showAlternative, setShowAlternative] = useState(false);

  // Poll QR code every 5 seconds
  const { data: qrData, isLoading: qrLoading } = useQuery<QrData, Error>({
    queryKey: ['whatsapp_qr'],
    queryFn: async (): Promise<QrData> => {
      const res = await fetch('/api/whatsapp/qr');
      if (!res.ok) throw new Error('No se pudo obtener el código QR');
      return res.json() as Promise<QrData>;
    },
    refetchInterval: 5_000,
    staleTime: 4_000,
  });

  // Poll status
  const { data: statusData } = useQuery<{ status: string; connected: boolean }, Error>({
    queryKey: ['whatsapp_status_poll'],
    queryFn: async (): Promise<{ status: string; connected: boolean }> => {
      const res = await fetch('/api/whatsapp/status');
      if (!res.ok) throw new Error('No se pudo obtener el estado');
      return res.json() as Promise<{ status: string; connected: boolean }>;
    },
    refetchInterval: 3_000,
    staleTime: 2_000,
  });

  // Advance when connected
  useEffect(() => {
    if (qrData?.connected || statusData?.connected || statusData?.status === 'connected') {
      onConnected();
    }
  }, [qrData, statusData, onConnected]);

  const instructions =
    accountType === 'business'
      ? [
          'Abre WhatsApp Business en tu teléfono',
          'Toca los tres puntos (⋮) en la esquina superior derecha',
          'Selecciona "Dispositivos vinculados"',
          'Toca "Vincular un dispositivo"',
          'Escanea este código QR con la cámara',
        ]
      : [
          'Abre WhatsApp en tu teléfono',
          'Ve a Configuración (ícono de engranaje)',
          'Selecciona "Dispositivos vinculados"',
          'Toca "Vincular un dispositivo"',
          'Escanea este código QR con la cámara',
        ];

  return (
    <div className="space-y-6">
      {/* QR code */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-56 w-56 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30">
          {qrLoading && !qrData ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : qrData?.qr ? (
            <Image
              src={qrData.qr}
              alt="Código QR de WhatsApp"
              fill
              className="rounded-xl object-contain p-2"
              unoptimized
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
              <MessageCircle className="h-10 w-10" />
              <p className="text-xs">Generando código QR…</p>
            </div>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Esperando escaneo…</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Instrucciones
        </p>
        <ol className="space-y-2">
          {instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Alternative link */}
      <div className="rounded-lg border">
        <button
          type="button"
          onClick={() => setShowAlternative((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
        >
          <span>¿No puedes escanear?</span>
          {showAlternative ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {showAlternative && (
          <div className="border-t px-4 py-3">
            <p className="mb-3 text-sm text-muted-foreground">
              Vincular con número de teléfono
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4 shrink-0" />
              <span>Disponible próximamente</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Step 3 — Connected
// -------------------------------------------------------

interface Step3Props {
  onDisconnect: () => void;
}

function Step3({ onDisconnect }: Step3Props) {
  const router = useRouter();
  const { data: connection } = useWhatsAppConnection();

  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30">
        <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
      </div>

      <div>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          ¡WhatsApp conectado!
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu número ya está vinculado al hotel.
        </p>
      </div>

      {connection && (
        <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-xl border bg-muted/30 p-4">
          {connection.profile_pic_url && (
            <Image
              src={connection.profile_pic_url}
              alt="Foto de perfil"
              width={56}
              height={56}
              className="rounded-full border"
              unoptimized
            />
          )}
          {connection.display_name && (
            <p className="font-medium">{connection.display_name}</p>
          )}
          {connection.phone_e164 && (
            <p className="text-sm text-muted-foreground">{connection.phone_e164}</p>
          )}
          <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
            {connection.account_type === 'business' ? 'WhatsApp Business' : 'WhatsApp Personal'}
          </span>
        </div>
      )}

      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button className="w-full" onClick={() => router.push('/chat')}>
          Ir al Chat
        </Button>
        <Button variant="outline" size="sm" className="w-full" onClick={onDisconnect}>
          Desconectar
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Main page
// -------------------------------------------------------

export default function WhatsAppConfigPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: existingConnection } = useWhatsAppConnection();

  // If already connected, jump to step 3
  useEffect(() => {
    if (existingConnection?.status === 'connected') {
      setStep(3);
    }
  }, [existingConnection]);

  const handleContinue = useCallback(async () => {
    if (!accountType) return;
    setIsConnecting(true);
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? 'No se pudo iniciar la conexión');
      }
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al iniciar conexión');
    } finally {
      setIsConnecting(false);
    }
  }, [accountType]);

  const handleConnected = useCallback(() => {
    setStep(3);
  }, []);

  const handleDisconnect = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? 'No se pudo desconectar');
      }
      toast.success('WhatsApp desconectado');
      setStep(1);
      setAccountType(null);
      setUnderstood(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desconectar');
    }
  }, []);

  const stepLabels: Record<Step, string> = {
    1: 'Tipo de cuenta',
    2: 'Vincular dispositivo',
    3: 'Conectado',
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Conectar WhatsApp"
        description="Vincula el WhatsApp de tu hotel para chatear con los huéspedes"
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as Step[]).map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : step > s
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
            <span
              className={cn(
                'hidden text-xs sm:inline',
                step === s ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {stepLabels[s]}
            </span>
            {idx < 2 && (
              <div
                className={cn(
                  'h-px w-8 transition-colors',
                  step > s ? 'bg-green-500' : 'bg-border',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-xl border bg-card p-6 shadow-xs">
        {step === 1 && (
          <Step1
            accountType={accountType}
            onSelectType={setAccountType}
            understood={understood}
            onUnderstoodChange={setUnderstood}
            onContinue={handleContinue}
          />
        )}
        {step === 2 && accountType && (
          <Step2 accountType={accountType} onConnected={handleConnected} />
        )}
        {step === 3 && <Step3 onDisconnect={handleDisconnect} />}
      </div>

      {isConnecting && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Iniciando conexión…</span>
        </div>
      )}
    </div>
  );
}
