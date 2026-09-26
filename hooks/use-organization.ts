'use client';

import { useProfile } from '@/hooks/use-profile';

export type OrganizationData = NonNullable<
  ReturnType<typeof useProfile>['data']
>['organization'];

/**
 * Returns the current user's organization data derived from the profile query.
 * Re-uses the cached profile so no extra network request is made.
 */
export function useOrganization() {
  const { data: profile, isLoading, error } = useProfile();

  return {
    organization: profile?.organization ?? null,
    isLoading,
    error,
    timezone: profile?.organization?.timezone ?? 'UTC',
    currency: profile?.organization?.currency ?? 'USD',
    locale: profile?.organization?.locale ?? 'es',
  };
}
