'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface InsightsMetricData {
  total: number;
  breakdowns: Record<string, Record<string, number>>;
}

export interface InsightsResponse {
  metrics: Record<string, InsightsMetricData>;
  reachTimeSeries: Array<{ date: string; value: number }>;
  followerSeries: Array<{ date: string; followers_count: number; follows_count: number; media_count: number }>;
  previousMetrics: Record<string, { total: number }> | null;
  currentFollowers: number;
  hasInsightsScope: boolean;
  hasData: boolean;
  fetchedAt: string | null;
  periodDays: number;
}

export type InsightsPeriod =
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'prev_month'
  | { type: 'month'; year: number; month: number }
  | { type: 'custom'; since: string; until: string };

// -------------------------------------------------------
// Period helpers
// -------------------------------------------------------

export function periodToDateRange(period: InsightsPeriod): { since: string; until: string } {
  const now = new Date();

  if (period === 'last_7_days') {
    const since = new Date(now);
    since.setDate(since.getDate() - 7);
    return { since: fmt(since), until: fmt(now) };
  }

  if (period === 'last_30_days') {
    const since = new Date(now);
    since.setDate(since.getDate() - 30);
    return { since: fmt(since), until: fmt(now) };
  }

  if (period === 'this_month') {
    const since = new Date(now.getFullYear(), now.getMonth(), 1);
    return { since: fmt(since), until: fmt(now) };
  }

  if (period === 'prev_month') {
    const since = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const until = new Date(now.getFullYear(), now.getMonth(), 0);
    return { since: fmt(since), until: fmt(until) };
  }

  if (typeof period === 'object' && period.type === 'month') {
    const since = new Date(period.year, period.month - 1, 1);
    const until = new Date(period.year, period.month, 0);
    return { since: fmt(since), until: fmt(until) };
  }

  if (typeof period === 'object' && period.type === 'custom') {
    return { since: period.since, until: period.until };
  }

  return { since: fmt(new Date()), until: fmt(new Date()) };
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function periodLabel(period: InsightsPeriod): string {
  if (period === 'last_7_days') return 'Últimos 7 días';
  if (period === 'last_30_days') return 'Últimos 30 días';
  if (period === 'this_month') return 'Este mes';
  if (period === 'prev_month') return 'Mes anterior';
  if (typeof period === 'object' && period.type === 'month') {
    const d = new Date(period.year, period.month - 1, 1);
    return d.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  }
  if (typeof period === 'object' && period.type === 'custom') {
    return `${period.since} — ${period.until}`;
  }
  return '';
}

// -------------------------------------------------------
// Hook
// -------------------------------------------------------

export function useInstagramInsights(period: InsightsPeriod, compare: boolean = true) {
  const { since, until } = periodToDateRange(period);

  return useQuery({
    queryKey: ['instagram_insights', since, until, compare],
    queryFn: async (): Promise<InsightsResponse> => {
      const params = new URLSearchParams({ since, until });
      if (compare) params.set('compare', '1');

      const res = await fetch(`/api/instagram/insights?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error al obtener estadísticas (${res.status})`);
      }
      return res.json();
    },
    staleTime: 5 * 60_000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useRefreshInsights() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/instagram/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al actualizar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram_insights'] });
    },
  });
}
