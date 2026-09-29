'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AutomationRow = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AutomationRunRow = Record<string, any>;

async function fetchAutomations(): Promise<AutomationRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function useAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: fetchAutomations,
    staleTime: 30 * 1000,
  });
}

async function fetchAutomationDetail(id: string): Promise<AutomationRow | null> {
  const supabase = createClient();
  const [automationRes, stepsRes] = await Promise.all([
    supabase.from('automations').select('*').eq('id', id).single(),
    supabase.from('automation_steps').select('*').eq('automation_id', id).order('position'),
  ]);
  if (automationRes.error) throw automationRes.error;
  return { ...automationRes.data, steps: stepsRes.data ?? [] };
}

export function useAutomationDetail(id: string | null) {
  return useQuery({
    queryKey: ['automation_detail', id],
    queryFn: () => fetchAutomationDetail(id!),
    enabled: !!id,
    staleTime: 15 * 1000,
  });
}

async function fetchAutomationRuns(automationId: string): Promise<AutomationRunRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('automation_runs')
    .select('*')
    .eq('automation_id', automationId)
    .order('started_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export function useAutomationRuns(automationId: string | null) {
  return useQuery({
    queryKey: ['automation_runs', automationId],
    queryFn: () => fetchAutomationRuns(automationId!),
    enabled: !!automationId,
    staleTime: 15 * 1000,
  });
}

async function fetchRecentEvents(): Promise<AutomationRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('automation_events')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export function useRecentEvents() {
  return useQuery({
    queryKey: ['automation_events_recent'],
    queryFn: fetchRecentEvents,
    staleTime: 15 * 1000,
  });
}
