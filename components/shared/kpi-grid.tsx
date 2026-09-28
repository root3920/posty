import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface KpiGridProps {
  children: ReactNode;
  className?: string;
}

export function KpiGrid({ children, className }: KpiGridProps) {
  return (
    <div
      data-slot="kpi-grid"
      className={cn(
        // Container query context
        '@container/kpi-grid',
        // CSS grid with auto-fill + minmax
        'grid gap-3 md:gap-4 xl:gap-5',
        className,
      )}
      style={{
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      }}
    >
      {children}
    </div>
  );
}
