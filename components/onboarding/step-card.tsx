'use client';

import Link from 'next/link';
import { Check, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OnboardingStepState } from '@/lib/onboarding/types';

interface StepCardProps {
  step: OnboardingStepState;
  onSkip?: (stepId: string) => void;
  onUnskip?: (stepId: string) => void;
  onNavigate?: () => void;
}

export function StepCard({ step, onSkip, onUnskip, onNavigate }: StepCardProps) {
  const isDone = step.done;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
        isDone ? 'opacity-60' : 'hover:bg-muted/50',
      )}
    >
      {/* Checkbox circle */}
      <div
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          isDone
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-muted-foreground/30',
        )}
      >
        {isDone && <Check className="h-3 w-3" />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', isDone && 'line-through')}>
          {step.title}
        </p>
        <p className="text-xs text-muted-foreground">{step.why}</p>
      </div>

      {/* Actions */}
      {!isDone && (
        <div className="flex shrink-0 items-center gap-1">
          {step.skippable && onSkip && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => onSkip(step.id)}
              title="Marcar como no aplica"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Link href={step.href} onClick={onNavigate}>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
              Configurar
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      )}

      {step.skipped && onUnskip && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 text-xs text-muted-foreground"
          onClick={() => onUnskip(step.id)}
        >
          Reactivar
        </Button>
      )}
    </div>
  );
}
