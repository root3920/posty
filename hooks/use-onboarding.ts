'use client';

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { usePermissions } from '@/hooks/use-permissions';
import { ONBOARDING_STEPS, ESSENTIAL_STEP_IDS } from '@/lib/onboarding/steps';
import type { OnboardingCounts, OnboardingStepState, OnboardingStage } from '@/lib/onboarding/types';
import { STAGE_ORDER } from '@/lib/onboarding/types';

// -------------------------------------------------------
// Data fetching
// -------------------------------------------------------

/**
 * Fetches onboarding completion counts.
 * Tries the dedicated RPC first; falls back to individual queries
 * if the RPC doesn't exist yet (migration not applied).
 */
function useOnboardingCounts() {
  return useQuery({
    queryKey: ['onboarding_counts'],
    queryFn: async (): Promise<OnboardingCounts> => {
      const supabase = createClient();

      // Try the RPC first (fast, single query)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_onboarding_counts');
      if (!error && data) {
        return data as OnboardingCounts;
      }

      // Fallback: query tables directly (works even without the migration)
      console.warn('[onboarding] RPC failed, using fallback queries:', error?.message);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      const [rtRes, rmRes, stRes, tmRes, pmRes, evRes, rcRes, waRes, igRes, orgRes, wsRes, ctRes] = await Promise.all([
        db.from('room_types').select('id', { count: 'exact', head: true }).is('archived_at', null),
        db.from('rooms').select('id', { count: 'exact', head: true }).eq('is_active', true),
        db.from('stays').select('id', { count: 'exact', head: true }),
        db.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
        db.from('payment_methods').select('id', { count: 'exact', head: true }).is('archived_at', null),
        db.from('event_venues').select('id', { count: 'exact', head: true }).eq('is_active', true),
        db.from('recurring_tasks').select('id', { count: 'exact', head: true }).eq('is_active', true),
        db.from('whatsapp_connections').select('id', { count: 'exact', head: true }).eq('status', 'connected'),
        db.from('instagram_connections').select('id', { count: 'exact', head: true }).eq('status', 'connected'),
        db.from('organizations').select('tax_id, rnt_number, logo_url').limit(1).single(),
        db.from('work_schedules').select('id', { count: 'exact', head: true }),
        db.from('cleaning_types').select('id', { count: 'exact', head: true }).is('archived_at', null),
      ]);

      const org = orgRes.data;

      return {
        room_types: rtRes.count ?? 0,
        rooms: rmRes.count ?? 0,
        stays: stRes.count ?? 0,
        team_members: tmRes.count ?? 0,
        payment_methods: pmRes.count ?? 0,
        event_venues: evRes.count ?? 0,
        recurring_tasks: rcRes.count ?? 0,
        whatsapp_connected: waRes.count ?? 0,
        instagram_connected: igRes.count ?? 0,
        has_tax_id: !!(org?.tax_id && org.tax_id.trim()),
        has_rnt: !!(org?.rnt_number && org.rnt_number.trim()),
        has_logo: !!(org?.logo_url && org.logo_url.trim()),
        work_schedules: wsRes.count ?? 0,
        cleaning_types: ctRes.count ?? 0,
      };
    },
    staleTime: 30_000,
  });
}

function useOnboardingState() {
  return useQuery({
    queryKey: ['onboarding_state'],
    queryFn: async (): Promise<Record<string, string>> => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_onboarding_state');
      if (error) {
        // RPC may not exist if migration not applied yet — not critical
        console.warn('[onboarding] state RPC not available:', error.message);
        return {};
      }
      return (data as Record<string, string>) ?? {};
    },
    staleTime: 60_000,
  });
}

// -------------------------------------------------------
// Main hook
// -------------------------------------------------------

export function useOnboarding() {
  const { data: counts, isLoading: countsLoading } = useOnboardingCounts();
  const { data: state = {}, isLoading: stateLoading } = useOnboardingState();
  const { canViewModule } = usePermissions();
  const queryClient = useQueryClient();

  // Mutation to set state
  const setStateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('set_onboarding_state', {
        p_key: key,
        p_value: value,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding_state'] });
    },
  });

  // Build step states
  const steps: OnboardingStepState[] = useMemo(() => {
    if (!counts) return [];

    return ONBOARDING_STEPS
      .filter((step) => {
        // Filter by permission
        if (step.requiredModule && !canViewModule(step.requiredModule)) return false;
        return true;
      })
      .map((step) => {
        const completed = step.checkCompleted(counts);
        const skipped = state[`step_skipped:${step.id}`] === 'true';
        return {
          ...step,
          completed,
          skipped,
          done: completed || skipped,
        };
      });
  }, [counts, state, canViewModule]);

  // Group by stage
  const stepsByStage = useMemo(() => {
    const grouped: Record<OnboardingStage, OnboardingStepState[]> = {
      essential: [], team: [], operations: [], optional: [],
    };
    for (const step of steps) {
      grouped[step.stage].push(step);
    }
    return grouped;
  }, [steps]);

  // Progress
  const totalSteps = steps.length;
  const doneSteps = steps.filter((s) => s.done).length;
  const progressPct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  // Essential completed?
  const essentialDone = steps
    .filter((s) => ESSENTIAL_STEP_IDS.includes(s.id))
    .every((s) => s.done);

  // State flags
  const isWizardSeen = state.wizard_seen === 'true';
  const isPanelMinimized = state.panel_minimized === 'true';

  // Actions
  const markWizardSeen = useCallback(() => {
    setStateMutation.mutate({ key: 'wizard_seen', value: 'true' });
  }, [setStateMutation]);

  const togglePanelMinimized = useCallback(() => {
    const newVal = isPanelMinimized ? 'false' : 'true';
    setStateMutation.mutate({ key: 'panel_minimized', value: newVal });
  }, [isPanelMinimized, setStateMutation]);

  const markStepSkipped = useCallback((stepId: string) => {
    setStateMutation.mutate({ key: `step_skipped:${stepId}`, value: 'true' });
  }, [setStateMutation]);

  const unmarkStepSkipped = useCallback((stepId: string) => {
    setStateMutation.mutate({ key: `step_skipped:${stepId}`, value: 'false' });
  }, [setStateMutation]);

  const markTourSeen = useCallback((module: string) => {
    setStateMutation.mutate({ key: `tour_seen:${module}`, value: 'true' });
  }, [setStateMutation]);

  const isTourSeen = useCallback((module: string) => {
    return state[`tour_seen:${module}`] === 'true';
  }, [state]);

  return {
    steps,
    stepsByStage,
    stageOrder: STAGE_ORDER,
    totalSteps,
    doneSteps,
    progressPct,
    essentialDone,
    isWizardSeen,
    isPanelMinimized,
    isLoading: countsLoading || stateLoading,

    // Actions
    markWizardSeen,
    togglePanelMinimized,
    markStepSkipped,
    unmarkStepSkipped,
    markTourSeen,
    isTourSeen,
  };
}
