'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Phone, Copy, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContactActionsProps {
  phone: string; // E.164 format
  /** Size of the action icons */
  size?: 'sm' | 'md';
  className?: string;
}

export function ContactActions({ phone, size = 'sm', className }: ContactActionsProps) {
  if (!phone) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = size === 'sm' ? 'p-0.5' : 'p-1';
  const digits = phone.replace(/\D/g, '');

  function handleCopy() {
    navigator.clipboard.writeText(phone);
    toast.success('Número copiado');
  }

  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {/* WhatsApp — opens /chat if connected, wa.me fallback */}
      <a
        href={`/chat?phone=${encodeURIComponent(phone)}`}
        aria-label="Chat en POSTY"
        title="Abrir chat"
        className={cn('rounded text-[#25D366] hover:bg-[#25D366]/10 transition-colors', btnSize)}
      >
        <MessageCircle className={iconSize} />
      </a>
      {/* Call */}
      <a
        href={`tel:${phone}`}
        aria-label="Llamar"
        title="Llamar"
        className={cn('rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors', btnSize)}
      >
        <Phone className={iconSize} />
      </a>
      {/* Copy */}
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copiar número"
        title="Copiar"
        className={cn('rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors', btnSize)}
      >
        <Copy className={iconSize} />
      </button>
    </span>
  );
}
