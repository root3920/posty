'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveDialog } from '@/components/shared/responsive-dialog';
import { useSendEmail, useEmailSuppression } from '@/hooks/use-email';
import { useProfile } from '@/hooks/use-profile';

// -------------------------------------------------------
// Quick reply templates
// -------------------------------------------------------

const QUICK_TEMPLATES = [
  {
    label: 'Bienvenida',
    subject: 'Bienvenido a nuestro hotel',
    body: 'Es un placer darle la bienvenida. Estamos a su disposición para lo que necesite durante su estadía.\n\nNo dude en contactarnos si tiene alguna pregunta o solicitud especial.',
  },
  {
    label: 'Agradecimiento',
    subject: 'Gracias por su visita',
    body: 'Queremos agradecerle por haberse hospedado con nosotros. Esperamos que su estadía haya sido agradable.\n\nSerá un placer recibirle de nuevo en el futuro.',
  },
  {
    label: 'Recordatorio',
    subject: 'Información importante sobre su reserva',
    body: 'Le escribimos para recordarle algunos detalles importantes sobre su próxima estadía.\n\nSi tiene alguna pregunta, no dude en responder a este correo.',
  },
];

// -------------------------------------------------------
// Schema
// -------------------------------------------------------

const sendEmailSchema = z.object({
  subject: z.string().min(1, 'El asunto es obligatorio').max(200),
  body: z.string().min(1, 'El mensaje es obligatorio').max(10000),
});

type SendEmailForm = z.infer<typeof sendEmailSchema>;

// -------------------------------------------------------
// Component
// -------------------------------------------------------

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId: string;
  guestName: string;
  guestEmail: string;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  guestId,
  guestName,
  guestEmail,
}: SendEmailDialogProps) {
  const { data: profile } = useProfile();
  const orgId = profile?.organization_id ?? null;
  const { data: suppression } = useEmailSuppression(guestEmail, orgId);
  const sendEmail = useSendEmail();

  const form = useForm<SendEmailForm>({
    resolver: zodResolver(sendEmailSchema),
    defaultValues: { subject: '', body: '' },
  });

  const onSubmit = (values: SendEmailForm) => {
    sendEmail.mutate(
      {
        guestId,
        to: guestEmail,
        subject: values.subject,
        body: values.body,
        guestName: guestName.split(' ')[0], // First name for greeting
      },
      {
        onSuccess: () => {
          form.reset();
          onOpenChange(false);
        },
      },
    );
  };

  const applyTemplate = (tpl: typeof QUICK_TEMPLATES[number]) => {
    form.setValue('subject', tpl.subject, { shouldValidate: true });
    form.setValue('body', tpl.body, { shouldValidate: true });
  };

  const isSuppressed = !!suppression;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Enviar correo"
      description={`Para: ${guestName} <${guestEmail}>`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={sendEmail.isPending || isSuppressed}
          >
            {sendEmail.isPending && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Enviar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Suppression warning */}
        {isSuppressed && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
              <p className="text-destructive">
                {suppression.reason === 'bounce'
                  ? 'Este correo rebotó previamente. No se pueden enviar más correos a esta dirección.'
                  : suppression.reason === 'complaint'
                    ? 'Este destinatario marcó un correo anterior como spam.'
                    : 'Este destinatario se ha dado de baja.'}
              </p>
            </div>
          </div>
        )}

        {/* Quick templates */}
        <div>
          <Label className="text-xs text-muted-foreground">Plantillas rápidas</Label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {QUICK_TEMPLATES.map((tpl) => (
              <Button
                key={tpl.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => applyTemplate(tpl)}
              >
                {tpl.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <Label htmlFor="email-subject">Asunto *</Label>
          <Input
            id="email-subject"
            placeholder="Asunto del correo"
            {...form.register('subject')}
          />
          {form.formState.errors.subject && (
            <p className="text-xs text-destructive">
              {form.formState.errors.subject.message}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <Label htmlFor="email-body">Mensaje *</Label>
          <Textarea
            id="email-body"
            placeholder="Escribe el mensaje..."
            rows={8}
            className="resize-none"
            {...form.register('body')}
          />
          {form.formState.errors.body && (
            <p className="text-xs text-destructive">
              {form.formState.errors.body.message}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            El correo se enviará con el diseño y colores del hotel. Se incluye
            saludo automático &quot;Hola {guestName.split(' ')[0]},&quot; y despedida.
          </p>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
