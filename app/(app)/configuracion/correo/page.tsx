'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import {
  Mail,
  CheckCircle2,
  Loader2,
  Send,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useProfile } from '@/hooks/use-profile';
import { useSendTestEmail, useUpdateContactEmail } from '@/hooks/use-email';
import { createClient } from '@/lib/supabase/client';

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
// Fetch organization
// -------------------------------------------------------

function useOrganizationData(orgId: string | undefined) {
  return useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      const supabase = createClient() as any;
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, contact_email, brand_color, logo_url')
        .eq('id', orgId!)
        .single();
      if (error) throw error;
      return data as {
        id: string; name: string; contact_email: string | null;
        brand_color: string | null; logo_url: string | null;
      };
    },
    enabled: !!orgId,
  });
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function EmailConfigPage() {
  const { data: profile } = useProfile();
  const orgId = profile?.organization_id;
  const { data: org, isLoading } = useOrganizationData(orgId);

  const sendTestEmail = useSendTestEmail();
  const updateContactEmail = useUpdateContactEmail();

  // Contact email form
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
      const { count } = await supabase
        .from('email_messages')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId!);
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

      {isLoading ? (
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
                  {org?.name ?? 'Hotel'} vía POSTY &lt;noreply@postyassistant.com&gt;
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Correos enviados</span>
                <span className="font-medium tabular-nums">{emailStats?.total ?? 0}</span>
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
