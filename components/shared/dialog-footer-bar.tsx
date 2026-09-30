'use client';

import type { ReactNode } from 'react';

/**
 * Standard footer bar for ResponsiveDialog.
 *
 * Layout:
 * - Row 1 (optional): summary line spanning full width
 * - Row 2: secondary action left, primary action right
 *
 * On mobile: buttons stack vertically, primary at the bottom (near thumb).
 * Never overflows — uses flex-wrap and min-w-0.
 */

interface DialogFooterBarProps {
  /** Optional summary line (e.g. "Total $ 650.000") */
  summary?: ReactNode;
  /** Secondary action button (e.g. "Anterior") — left side */
  secondary?: ReactNode;
  /** Primary action button(s) — right side */
  primary: ReactNode;
}

export function DialogFooterBar({ summary, secondary, primary }: DialogFooterBarProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {summary && (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {summary}
        </div>
      )}
      <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 shrink-0">{secondary}</div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          {primary}
        </div>
      </div>
    </div>
  );
}
