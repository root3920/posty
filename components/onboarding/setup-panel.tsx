'use client';

import { useState } from 'react';
import { ChevronDown, Minimize2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
// eslint-disable-next-line no-restricted-imports -- Setup panel is a side panel, not a form dialog
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/hooks/use-onboarding';
import { StepCard } from './step-card';
import { STAGE_LABELS } from '@/lib/onboarding/types';

interface SetupPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetupPanel({ open, onOpenChange }: SetupPanelProps) {
  const {
    stepsByStage,
    stageOrder,
    totalSteps,
    doneSteps,
    progressPct,
    essentialDone,
    togglePanelMinimized,
    markStepSkipped,
    unmarkStepSkipped,
  } = useOnboarding();

  const [expandedStage, setExpandedStage] = useState<string | null>('essential');

  function handleNavigate() {
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="w-[min(90vw,400px)] p-0 gap-0 flex flex-col"
      >
        <SheetHeader className="shrink-0 border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle className="text-base">Configura tu hotel</SheetTitle>
              <SheetDescription className="text-xs">
                {doneSteps} de {totalSteps} pasos completados
              </SheetDescription>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {essentialDone && (
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
              ¡Lo esencial está listo! Los pasos restantes son opcionales.
            </p>
          )}
        </SheetHeader>

        {/* Steps grouped by stage */}
        <div className="flex-1 overflow-y-auto">
          {stageOrder.map((stage) => {
            const stageSteps = stepsByStage[stage];
            if (stageSteps.length === 0) return null;

            const stageDone = stageSteps.filter((s) => s.done).length;
            const isExpanded = expandedStage === stage;

            return (
              <div key={stage} className="border-b last:border-0">
                <button
                  type="button"
                  onClick={() => setExpandedStage(isExpanded ? null : stage)}
                  className="flex w-full items-center gap-2 px-5 py-3 text-left hover:bg-muted/30"
                >
                  <span className="flex-1 text-sm font-semibold">
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {stageDone}/{stageSteps.length}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform',
                      isExpanded && 'rotate-180',
                    )}
                  />
                </button>

                {isExpanded && (
                  <div className="px-2 pb-2">
                    {stageSteps.map((step) => (
                      <StepCard
                        key={step.id}
                        step={step}
                        onSkip={step.skippable ? markStepSkipped : undefined}
                        onUnskip={step.skipped ? unmarkStepSkipped : undefined}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-2 text-xs text-muted-foreground"
            onClick={() => { togglePanelMinimized(); onOpenChange(false); }}
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Minimizar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
