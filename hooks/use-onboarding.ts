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

function useOnboardingCounts() {
  return useQuery({
    queryKey: ['onboarding_counts'],
    queryFn: async (): Promise<OnboardingCounts> => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_onboarding_counts');
      if (error) {
        console.error('[onboarding] counts error:', error);
        return {
          room_types: 0, rooms: 0, stays: 0, team_members: 0,
          payment_methods: 0, event_venues: 0, recurring_tasks: 0,
          whatsapp_connected: 0, instagram_connected: 0,
          has_tax_id: false, has_rnt: false, has_logo: false,
        };
      }
      return data as OnboardingCounts;
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
        console.error('[onboarding] state error:', error);
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
