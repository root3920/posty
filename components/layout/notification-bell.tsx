'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useOnboarding } from '@/hooks/use-onboarding';
import { usePermissions } from '@/hooks/use-permissions';
import { useEmailUnreadCount } from '@/hooks/use-email-inbox';
import { STAGE_LABELS } from '@/lib/onboarding/types';

/**
 * Notification bell in the header.
 * Shows pending essential onboarding steps + email unread count.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { steps, essentialDone, isLoading } = useOnboarding();
  const { canViewModule } = usePermissions();
  const { data: emailUnread = 0 } = useEmailUnreadCount();

  // Only show for Gestor
  const isGestor = canViewModule('settings');

  // Pending essential steps
  const pendingEssential = steps.filter(
    (s) => s.stage === 'essential' && !s.done,
  );

  const hasOnboarding = isGestor && !essentialDone && pendingEssential.length > 0;
  const hasEmailNotif = emailUnread > 0;
  const hasNotifications = hasOnboarding || hasEmailNotif;
  const totalCount = (hasOnboarding ? pendingEssential.length : 0) + (hasEmailNotif ? 1 : 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notificaciones"
            className="relative rounded-[10px]"
          />
        }
      >
        <Bell className="h-4 w-4" />
        {hasNotifications && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
            {totalCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificaciones</p>
        </div>

        {isLoading ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">Cargando...</div>
        ) : !hasNotifications ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-xs text-muted-foreground">
              {essentialDone ? '¡Todo al día!' : 'Sin notificaciones pendientes'}
            </p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {/* Email unread notification */}
            {hasEmailNotif && (
              <div className="px-4 py-2">
                <Link
                  href="/correo"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-muted"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
                    <Mail className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {emailUnread === 1
                        ? '1 correo sin leer'
                        : `${emailUnread} correos sin leer`}
                    </p>
                    <p className="text-muted-foreground">Ir al buzón de correo</p>
                  </div>
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                </Link>
              </div>
            )}

            {/* Onboarding steps */}
            {hasOnboarding && (
              <div className="px-4 py-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pasos pendientes · {STAGE_LABELS.essential}
                </p>
                {pendingEssential.map((step) => (
                  <Link
                    key={step.id}
                    href={step.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-muted"
                  >
                    <div className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{step.title}</p>
                      <p className="text-muted-foreground">{step.why}</p>
                    </div>
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
