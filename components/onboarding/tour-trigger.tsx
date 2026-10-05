'use client';

import { useTour } from '@/hooks/use-tour';

/**
 * Invisible component that triggers a guided tour on first visit.
 * Mount it inside the page component for the module.
 *
 * Usage: <TourTrigger module="hotel" />
 */
export function TourTrigger({ module }: { module: string }) {
  useTour(module);
  return null;
}
