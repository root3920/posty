'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Phone, Copy, MessageCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SendEmailDialog } from '@/components/email/send-email-dialog';

interface ContactActionsProps {
  phone: string; // E.164 format
  /** Size of the action icons */
  size?: 'sm' | 'md';
  className?: string;
  /** Guest info for email — if provided, shows email button */
  email?: {
    guestId: string;
    guestName: string;
    guestEmail: string;
  };
}

export function ContactActions({ phone, size = 'sm', className, email }: ContactActionsProps) {
  const [emailOpen, setEmailOpen] = useState(false);

  if (!phone && !email) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = size === 'sm' ? 'p-0.5' : 'p-1';

  function handleCopy() {
    navigator.clipboard.writeText(phone);
    toast.success('Número copiado');
  }

  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {/* WhatsApp — opens /chat if connected */}
      {phone && (
        <a
          href={`/chat?phone=${encodeURIComponent(phone)}`}
          aria-label="Chat en POSTY"
          title="Abrir chat"
          className={cn('rounded text-[#25D366] hover:bg-[#25D366]/10 transition-colors', btnSize)}
        >
          <MessageCircle className={iconSize} />
        </a>
      )}
      {/* Call */}
      {phone && (
        <a
          href={`tel:${phone}`}
          aria-label="Llamar"
          title="Llamar"
          className={cn('rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors', btnSize)}
        >
          <Phone className={iconSize} />
        </a>
      )}
      {/* Copy phone */}
      {phone && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar número"
          title="Copiar"
          className={cn('rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors', btnSize)}
        >
          <Copy className={iconSize} />
        </button>
      )}
      {/* Email */}
      {email && (
        <>
          <button
            type="button"
            onClick={() => setEmailOpen(true)}
            aria-label="Enviar correo"
            title="Enviar correo"
            className={cn('rounded text-blue-600 hover:bg-blue-600/10 transition-colors dark:text-blue-400', btnSize)}
          >
            <Mail className={iconSize} />
          </button>
          <SendEmailDialog
            open={emailOpen}
            onOpenChange={setEmailOpen}
            guestId={email.guestId}
            guestName={email.guestName}
            guestEmail={email.guestEmail}
          />
        </>
      )}
    </span>
  );
}
