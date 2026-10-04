import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Shown inline on desktop. On mobile, shown below the title in a wrapped row. */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 space-y-3', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {/* Actions: hidden on mobile, inline on desktop */}
        {actions && (
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            {actions}
          </div>
        )}
      </div>

      {/* Mobile actions: shown below the title */}
      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:hidden">
          {actions}
        </div>
      )}
    </div>
  );
}
