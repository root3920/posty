'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

// -------------------------------------------------------
// Signed URL cache hook
// -------------------------------------------------------

/**
 * Fetches signed avatar URLs for a batch of contact IDs.
 * Cached for 50 minutes (URLs are valid for 60 min).
 */
export function useAvatarUrls(contactIds: string[]) {
  // Sort + dedupe for stable query key
  const sorted = [...new Set(contactIds.filter(Boolean))].sort();
  const key = sorted.join(',');

  return useQuery({
    queryKey: ['avatar_urls', key],
    queryFn: async (): Promise<Record<string, string | null>> => {
      if (sorted.length === 0) return {};
      const res = await fetch('/api/whatsapp/avatar-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: sorted }),
      });
      if (!res.ok) return {};
      const data = await res.json();
      return data.urls ?? {};
    },
    enabled: sorted.length > 0,
    staleTime: 50 * 60_000, // 50 minutes (URLs valid for 60 min)
    refetchOnWindowFocus: false,
  });
}

// -------------------------------------------------------
// Avatar fetch trigger
// -------------------------------------------------------

/**
 * Triggers avatar fetch for one or more contacts.
 * Called when a conversation is opened or becomes visible.
 */
export function useFetchAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactIds: string[]) => {
      const res = await fetch('/api/whatsapp/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds }),
      });
      if (!res.ok) return { fetched: 0, skipped: 0, results: [] };
      return res.json() as Promise<{
        fetched: number;
        skipped: number;
        results: Array<{ contactId: string; status: string }>;
      }>;
    },
    onSuccess: (data) => {
      // If any avatars were fetched, refresh the signed URLs
      const fetchedIds = data.results
        ?.filter((r: { status: string }) => r.status === 'ok')
        .map((r: { contactId: string }) => r.contactId) ?? [];
      if (fetchedIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['avatar_urls'] });
      }
    },
  });
}

// -------------------------------------------------------
// Auto-fetch on visibility
// -------------------------------------------------------

/**
 * Automatically triggers avatar fetch for contacts that become visible.
 * Uses IntersectionObserver to detect when conversation items enter the viewport.
 * Debounces to batch requests.
 */
export function useAutoFetchAvatars() {
  const pendingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAvatar = useFetchAvatar();

  const flush = useCallback(() => {
    if (pendingRef.current.size === 0) return;
    const ids = [...pendingRef.current];
    pendingRef.current.clear();
    fetchAvatar.mutate(ids);
  }, [fetchAvatar]);

  const enqueue = useCallback((contactId: string) => {
    if (!contactId) return;
    pendingRef.current.add(contactId);

    // Debounce: wait 500ms to batch nearby enqueues
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 500);
  }, [flush]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { enqueue, flush };
}
