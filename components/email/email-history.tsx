'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Mail, CheckCircle2, XCircle, Clock, AlertTriangle, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGuestEmails } from '@/hooks/use-email';

// -------------------------------------------------------
// Status badge config
// -------------------------------------------------------

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: typeof Mail;
  className: string;
}> = {
  queued: { label: 'En cola', icon: Clock, className: 'border-slate-200 text-slate-600 bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:bg-slate-900' },
  sent: { label: 'Enviado', icon: Mail, className: 'border-blue-200 text-blue-700 bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:bg-blue-950' },
  delivered: { label: 'Entregado', icon: CheckCircle2, className: 'border-green-200 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-400 dark:bg-green-950' },
  opened: { label: 'Abierto', icon: Eye, className: 'border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950' },
  bounced: { label: 'Rebotado', icon: XCircle, className: 'border-red-200 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-950' },
  complained: { label: 'Spam', icon: AlertTriangle, className: 'border-orange-200 text-orange-700 bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:bg-orange-950' },
  failed: { label: 'Error', icon: XCircle, className: 'border-red-200 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-950' },
};

// -------------------------------------------------------
// Component
// -------------------------------------------------------

interface EmailHistoryProps {
  guestId: string;
}

export function EmailHistory({ guestId }: EmailHistoryProps) {
  const { data: emails = [], isLoading } = useGuestEmails(guestId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Mail className="h-8 w-8 opacity-40" />
        <p>No se han enviado correos a este huésped</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {emails.map((email) => {
        const config = STATUS_CONFIG[email.status] ?? STATUS_CONFIG.sent;
        const Icon = config.icon;

        return (
          <div
            key={email.id}
            className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{email.subject}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {email.to} · {format(new Date(email.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
              </p>
              {email.error && (
                <p className="text-xs text-destructive mt-0.5 truncate">{email.error}</p>
              )}
            </div>
            <Badge variant="outline" className={`shrink-0 gap-1 text-[10px] ${config.className}`}>
              <Icon className="h-3 w-3" />
              {config.label}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
