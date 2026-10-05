'use client';

import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateCtaProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

/**
 * Reusable empty state with onboarding CTA.
 * Used in modules that require setup before they can be used.
 */
export function EmptyStateCta({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateCtaProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
      <Link href={actionHref} className="mt-4">
        <Button size="sm" className="gap-1.5">
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  );
}
