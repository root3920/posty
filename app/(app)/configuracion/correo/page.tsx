'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  CheckCircle2,
  Loader2,
  Send,
  AlertCircle,
  Copy,
  Check,
  ArrowDownToLine,
  Info,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useProfile } from '@/hooks/use-profile';
import { useSendTestEmail, useUpdateContactEmail } from '@/hooks/use-email';
import {
  useEmailAlias,
  useUpdateEmailAlias,
  useGenerateEmailAlias,
} from '@/hooks/use-email-inbox';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

/* eslint-disable @typescript-eslint/no-explicit-any */

// -------------------------------------------------------
// Schemas
// -------------------------------------------------------

const contactEmailSchema = z.object({
  contact_email: z.string().email('Correo inválido').or(z.literal('')),
});

const testEmailSchema = z.object({
  test_to: z.string().email('Correo inválido'),
});

type ContactEmailForm = z.infer<typeof contactEmailSchema>;
type TestEmailForm = z.infer<typeof testEmailSchema>;

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function EmailConfigPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const org = profile?.organization;
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const sendTestEmail = useSendTestEmail();
  const updateContactEmail = useUpdateContactEmail();
  const { data: aliasData, isLoading: aliasLoading } = useEmailAlias();
  const updateAlias = useUpdateEmailAlias();
  const generateAlias = useGenerateEmailAlias();

  const [aliasInput, setAliasInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAliasChange, setShowAliasChange] = useState(false);

  // Sync alias input with current value
  useEffect(() => {
    if (aliasData?.alias) setAliasInput(aliasData.alias);
  }, [aliasData?.alias]);

  const handleSaveAlias = () => {
    const value = aliasInput.trim().toLowerCase();
    if (!value) return;
    updateAlias.mutate(value);
  };

  const handleGenerateAlias = () => {
    generateAlias.mutate(undefined, {
      onSuccess: (data) => {
        setAliasInput(data.alias);
        if (!data.alreadyExists) {
          updateAlias.mutate(data.alias);
        }
      },
    });
  };

  const handleCopyAddress = () => {
    if (aliasData?.fullAddress) {
      navigator.clipboard.writeText(aliasData.fullAddress);
      setCopied(true);
      toast.success('Dirección copiada');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleForwarding = async (checked: boolean) => {
    const supabase = createClient() as any;
    const { error } = await supabase
      .from('organizations')
      .update({ email_forward_inbound: checked })
      .eq('id', orgId);
    if (error) {
      toast.error('Error al actualizar la configuración');
    } else {
      toast.success(checked ? 'Reenvío activado' : 'Reenvío desactivado');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  };

  // Contact email form — values prop syncs when org data arrives
  const contactForm = useForm<ContactEmailForm>({
    resolver: zodResolver(contactEmailSchema),
    values: { contact_email: org?.contact_email ?? '' },
  });

  // Test email form
  const testForm = useForm<TestEmailForm>({
    resolver: zodResolver(testEmailSchema),
    defaultValues: { test_to: '' },
  });

  const onSaveContactEmail = (values: ContactEmailForm) => {
    updateContactEmail.mutate(values.contact_email || null);
  };

  const onSendTest = (values: TestEmailForm) => {
    sendTestEmail.mutate(values.test_to);
  };

  // Count sent emails
  const { data: emailStats } = useQuery({
    queryKey: ['email_stats', orgId],
    queryFn: async () => {
      const supabase = createClient() as any;
      const { count, error } = await supabase
        .from('email_messages')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId!);
      if (error) throw error;
      return { total: (count as number) ?? 0 };
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Correo electrónico</h1>
          <p className="text-sm text-muted-foreground">
            Configuración de envío de correos a huéspedes
          </p>
        </div>
      </div>

      {profileLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          {/* Connection status */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Estado de la conexión</h2>
              <Badge
                variant="outline"
                className="gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
              >
                <CheckCircle2 className="h-3 w-3" />
                Conectado
              </Badge>
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Proveedor</span>
                <span className="font-medium">Resend</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dominio</span>
                <span className="font-medium font-mono text-xs">postyassistant.com</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Remitente</span>
                <span className="font-medium text-xs">
                  {org?.name} vía POSTY &lt;noreply@postyassistant.com&gt;
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Correos enviados</span>
                <span className="font-medium tabular-nums">{emailStats?.total ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Hotel email address (alias) */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Dirección de correo del hotel</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Tu hotel tiene su propia dirección de correo para enviar y recibir
                mensajes a través de POSTY. Los huéspedes verán esta dirección como remitente.
              </p>
            </div>

            {aliasLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : aliasData?.alias ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1 font-mono text-sm font-medium">
                    {aliasData.fullAddress}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                    title="Copiar dirección"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {showAliasChange ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={aliasInput}
                        onChange={(e) => setAliasInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="mi-hotel"
                        className="flex-1 font-mono text-sm"
                        maxLength={40}
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          handleSaveAlias();
                          setShowAliasChange(false);
                        }}
                        disabled={updateAlias.isPending || aliasInput === aliasData.alias || !aliasInput.trim()}
                      >
                        {updateAlias.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowAliasChange(false);
                          setAliasInput(aliasData.alias ?? '');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Al cambiar el alias, el anterior seguirá recibiendo correos durante 90 días.
                      Solo se permiten letras minúsculas, números y guiones (3–40 caracteres).
                    </p>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAliasChange(true)}
                    className="text-xs"
                  >
                    Cambiar alias
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Aún no tienes una dirección de correo. Genera una automáticamente o elige un alias personalizado.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="mi-hotel"
                    className="flex-1 font-mono text-sm"
                    maxLength={40}
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveAlias}
                    disabled={updateAlias.isPending || !aliasInput.trim()}
                  >
                    {updateAlias.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Crear
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAlias}
                  disabled={generateAlias.isPending}
                  className="w-full"
                >
                  {generateAlias.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Generar automáticamente desde el nombre del hotel
                </Button>
              </div>
            )}
          </div>

          {/* Forwarding toggle */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Reenviar correos recibidos</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Cuando llegue un correo al buzón de POSTY, se enviará una copia a tu correo de contacto.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="forward-toggle" className="text-sm">
                Enviarme una copia de los correos recibidos
              </Label>
              <Switch
                id="forward-toggle"
                checked={org?.email_forward_inbound ?? true}
                onCheckedChange={handleToggleForwarding}
              />
            </div>
            {org?.email_forward_inbound && org?.contact_email && (
              <p className="text-xs text-muted-foreground">
                Las copias se enviarán a: <span className="font-medium">{org.contact_email}</span>
              </p>
            )}
            {org?.email_forward_inbound && !org?.contact_email && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Configura un correo de contacto arriba para recibir las copias.
              </p>
            )}
          </div>

          {/* Help: external forwarding */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/30">
            <div className="flex gap-2">
              <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5 dark:text-blue-400" />
              <div className="space-y-1 text-blue-800 dark:text-blue-300">
                <p className="font-medium">¿Ya usas otro correo para reservas?</p>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Configura un reenvío automático en tu proveedor de correo (Gmail, Outlook, etc.)
                  hacia <span className="font-mono font-medium">{aliasData?.fullAddress ?? 'tu-alias@hoteles.postyassistant.com'}</span> y
                  todos los correos llegarán también al buzón de POSTY.
                </p>
              </div>
            </div>
          </div>

          {/* Reply-To email */}
          <form onSubmit={contactForm.handleSubmit(onSaveContactEmail)} className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Correo de contacto (Reply-To)</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Cuando un huésped responda a un correo enviado desde POSTY, la respuesta
                llegará a este correo. Si no lo configuras, no podrán responder.
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  type="email"
                  placeholder="recepcion@mihotel.com"
                  {...contactForm.register('contact_email')}
                />
                {contactForm.formState.errors.contact_email && (
                  <p className="text-xs text-destructive">
                    {contactForm.formState.errors.contact_email.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={updateContactEmail.isPending}
              >
                {updateContactEmail.isPending && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Guardar
              </Button>
            </div>
          </form>

          {/* Test email */}
          <form onSubmit={testForm.handleSubmit(onSendTest)} className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Enviar correo de prueba</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Envía un correo de prueba para verificar que todo funciona correctamente.
                Verás el diseño con el logo y los colores de tu hotel.
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  type="email"
                  placeholder="tu@correo.com"
                  {...testForm.register('test_to')}
                />
                {testForm.formState.errors.test_to && (
                  <p className="text-xs text-destructive">
                    {testForm.formState.errors.test_to.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={sendTestEmail.isPending}
              >
                {sendTestEmail.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                Enviar prueba
              </Button>
            </div>
          </form>

          {/* Info box */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/30">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-blue-600 mt-0.5 dark:text-blue-400" />
              <div className="space-y-1 text-blue-800 dark:text-blue-300">
                <p className="font-medium">Sobre el envío de correos</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-700 dark:text-blue-400">
                  <li>Límite: 100 correos por hora por hotel</li>
                  <li>Si un correo rebota o es marcado como spam, ese destinatario se bloquea automáticamente</li>
                  <li>Los correos de servicio (reserva, pago) no requieren consentimiento</li>
                  <li>Los correos promocionales solo se envían con consentimiento del huésped (Ley 1581)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
