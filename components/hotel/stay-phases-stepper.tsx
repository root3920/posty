'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const PHASES = [
  { number: 1, label: 'Reserva' },
  { number: 2, label: 'Confirmación' },
  { number: 3, label: 'Pre-llegada' },
  { number: 4, label: 'Llegada' },
  { number: 5, label: 'Estadía' },
  { number: 6, label: 'Salida' },
  { number: 7, label: 'Post-estadía' },
] as const;

interface StayPhasesStepperProps {
  currentPhase: number;
}

/**
 * Derives the current phase from stay status and task completion.
 */
export function deriveCurrentPhase(
  status: string,
  tasks: { phase?: number | null; status_type?: string }[],
): number {
  // Phase completion: a phase is "done" when ALL its tasks have status_type = 'done'
  function isPhaseComplete(phase: number): boolean {
    const phaseTasks = tasks.filter((t) => t.phase === phase);
    if (phaseTasks.length === 0) return false;
    return phaseTasks.every((t) => t.status_type === 'done');
  }

  switch (status) {
    case 'reserved': {
      if (isPhaseComplete(3)) return 4; // pre-arrival done → arrival
      if (isPhaseComplete(2)) return 3; // confirmation done → pre-arrival
      if (isPhaseComplete(1)) return 2; // reservation review done → confirmation
      return 1;
    }
    case 'checked_in': {
      if (isPhaseComplete(4)) return 5; // arrival tasks done → stay
      return 4;
    }
    case 'checked_out': {
      if (isPhaseComplete(6)) return 7; // departure done → post-stay
      return 6;
    }
    case 'cancelled':
    case 'no_show':
      return 1;
    default:
      return 1;
  }
}

export function StayPhasesStepper({ currentPhase }: StayPhasesStepperProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {PHASES.map((phase, i) => {
        const isComplete = phase.number < currentPhase;
        const isCurrent = phase.number === currentPhase;

        return (
          <div key={phase.number} className="flex items-center">
            {i > 0 && (
              <div
                className={cn(
                  'h-0.5 w-4 sm:w-6',
                  isComplete ? 'bg-emerald-500' : 'bg-border',
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  isComplete && 'bg-emerald-500 text-white',
                  isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                  !isComplete && !isCurrent && 'bg-muted text-muted-foreground',
                )}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" /> : phase.number}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium whitespace-nowrap',
                  isCurrent ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {phase.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
