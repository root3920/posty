'use client';

import { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/hooks/use-onboarding';
import { usePermissions } from '@/hooks/use-permissions';
import { SetupPanel } from './setup-panel';

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Compact onboarding card for the Dashboard.
 * Shows progress and a CTA to open the full setup panel.
 * Only visible to Gestor when essential steps are incomplete.
 */
export function OnboardingSummaryCard() {
  const {
    doneSteps,
    totalSteps,
    progressPct,
    essentialDone,
    isPanelMinimized,
    isLoading,
  } = useOnboarding();
  const { canViewModule } = usePermissions();
  const [panelOpen, setPanelOpen] = useState(false);

  // Only show for Gestor
  if (!canViewModule('settings')) return null;
  if (isLoading || totalSteps === 0) return null;
  // Hide when all essential done and minimized
  if (essentialDone && isPanelMinimized) return null;

  return (
    <>
      <motion.section
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Configura tu hotel</h2>
            <p className="text-xs text-muted-foreground">
              {doneSteps} de {totalSteps} pasos completados
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0 gap-1"
            onClick={() => setPanelOpen(true)}
          >
            Ver pasos
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {essentialDone && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            ¡Lo esencial está listo! Revisa los pasos opcionales para sacarle más provecho a POSTY.
          </p>
        )}
      </motion.section>

      <SetupPanel open={panelOpen} onOpenChange={setPanelOpen} />
    </>
  );
}
