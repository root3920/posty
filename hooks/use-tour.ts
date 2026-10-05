'use client';

import { useEffect, useRef, useCallback } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useOnboarding } from '@/hooks/use-onboarding';
import { findTour } from '@/lib/onboarding/tours';

/**
 * Launches a guided tour for a module on first visit.
 * The tour auto-starts if the user hasn't seen it yet.
 * Call `replay()` to manually re-launch the tour.
 */
export function useTour(module: string) {
  const { isTourSeen, markTourSeen, isLoading } = useOnboarding();
  const hasLaunched = useRef(false);

  const launch = useCallback(() => {
    const tourDef = findTour(module);
    if (!tourDef || tourDef.steps.length === 0) return;

    // Check that at least the first element exists in the DOM
    const firstEl = document.querySelector(tourDef.steps[0].element);
    if (!firstEl) return;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.5)',
      stagePadding: 8,
      stageRadius: 10,
      popoverClass: 'posty-tour-popover',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Entendido',
      progressText: '{{current}} de {{total}}',
      onDestroyed: () => {
        markTourSeen(module);
      },
      steps: tourDef.steps.map((step) => ({
        element: step.element,
        popover: {
          title: step.title,
          description: step.description,
          side: step.side ?? 'bottom',
          align: 'center' as const,
        },
      })),
    });

    driverObj.drive();
  }, [module, markTourSeen]);

  // Auto-launch on first visit
  useEffect(() => {
    if (isLoading || hasLaunched.current) return;
    if (isTourSeen(module)) return;

    // Delay to let the page render and data-tour elements mount
    const timer = setTimeout(() => {
      hasLaunched.current = true;
      launch();
    }, 1000);

    return () => clearTimeout(timer);
  }, [isLoading, module, isTourSeen, launch]);

  // Listen for manual replay from profile menu
  useEffect(() => {
    function handleReplay() { launch(); }
    window.addEventListener('posty:replay-tour', handleReplay);
    return () => window.removeEventListener('posty:replay-tour', handleReplay);
  }, [launch]);

  return { replay: launch };
}
