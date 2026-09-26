'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

export function usePermissions() {
  const { data: permissions = [], isLoading } = useQuery<string[]>({
    queryKey: ['permissions'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_my_permissions');

      if (error) {
        console.error('Error fetching permissions:', error);
        return [];
      }

      return (data as string[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const helpers = useMemo(
    () => ({
      has: (key: string) => permissions.includes(key),
      hasAny: (...keys: string[]) => keys.some((k) => permissions.includes(k)),
      hasAll: (...keys: string[]) => keys.every((k) => permissions.includes(k)),
      canViewModule: (module: string) =>
        permissions.some((p) => p.startsWith(`${module}.view`)),
    }),
    [permissions],
  );

  return {
    permissions,
    isLoading,
    ...helpers,
  };
}
