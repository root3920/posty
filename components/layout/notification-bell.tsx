'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useOnboarding } from '@/hooks/use-onboarding';
import { usePermissions } from '@/hooks/use-permissions';
import { STAGE_LABELS } from '@/lib/onboarding/types';

/**
 * Notification bell in the header.
 * Shows pending essential onboarding steps as reminders.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { steps, essentialDone, isLoading } = useOnboarding();
  const { canViewModule } = usePermissions();

  // Only show for Gestor
  const isGestor = canViewModule('settings');

  // Pending essential steps
  const pendingEssential = steps.filter(
    (s) => s.stage === 'essential' && !s.done,
  );

  const hasNotifications = isGestor && !essentialDone && pendingEssential.length > 0;

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
            {pendingEssential.length}
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
            {pendingEssential.length > 0 && (
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
