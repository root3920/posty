'use client';

import { WelcomeWizard } from './welcome-wizard';

/**
 * Client wrapper for WelcomeWizard.
 * Mounted in the app layout (Server Component).
 */
export function WelcomeWizardWrapper() {
  return <WelcomeWizard />;
}
