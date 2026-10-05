'use client';

import { useState } from 'react';
import { useOnboarding } from '@/hooks/use-onboarding';
import { usePermissions } from '@/hooks/use-permissions';
import { SetupPanel } from './setup-panel';
import { cn } from '@/lib/utils';

/**
 * Floating button in the bottom-right corner showing onboarding progress.
 * Only visible to Gestor role. Hidden when all essential steps are done
 * and panel is minimized.
 */
export function SetupProgressButton() {
  const {
    progressPct,
    essentialDone,
    isPanelMinimized,
    isLoading,
    totalSteps,
  } = useOnboarding();
  const { canViewModule } = usePermissions();
  const [panelOpen, setPanelOpen] = useState(false);

  // Only show for users with settings access (Gestor)
  if (!canViewModule('settings')) return null;

  // Don't show while loading
  if (isLoading || totalSteps === 0) return null;

  // Hidden if essential done AND panel minimized
  if (essentialDone && isPanelMinimized) return null;

  // SVG circle progress
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progressPct / 100) * circumference;

  return (
    <>
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105',
          'bg-primary text-primary-foreground',
          'md:bottom-8 md:right-8',
        )}
        aria-label={`Configuración del hotel: ${progressPct}% completado`}
      >
        <svg width="44" height="44" className="absolute">
          {/* Background circle */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-20"
          />
          {/* Progress arc */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          />
        </svg>
        <span className="relative text-xs font-bold tabular-nums">{progressPct}%</span>
      </button>

      <SetupPanel open={panelOpen} onOpenChange={setPanelOpen} />
    </>
  );
}
