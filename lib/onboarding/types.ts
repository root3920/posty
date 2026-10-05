/**
 * Onboarding types — shared across steps, hooks, and components.
 */

export type OnboardingStage = 'essential' | 'team' | 'operations' | 'optional';

export interface OnboardingCounts {
  room_types: number;
  rooms: number;
  stays: number;
  team_members: number;
  payment_methods: number;
  event_venues: number;
  recurring_tasks: number;
  whatsapp_connected: number;
  instagram_connected: number;
  has_tax_id: boolean;
  has_rnt: boolean;
  has_logo: boolean;
  work_schedules: number;
  cleaning_types: number;
}

export interface OnboardingStepDef {
  /** Unique identifier */
  id: string;
  /** Grouping stage */
  stage: OnboardingStage;
  /** Short title shown in checklist */
  title: string;
  /** One-line explanation of why this matters */
  why: string;
  /** Route to navigate to for completing this step */
  href: string;
  /** Permission module required to see this step (null = visible to all) */
  requiredModule: string | null;
  /** Can the user mark this as "no aplica"? */
  skippable: boolean;
  /** Returns true if this step is completed, based on real data */
  checkCompleted: (counts: OnboardingCounts) => boolean;
}

export interface OnboardingStepState extends OnboardingStepDef {
  /** Whether this step is completed (derived from data) */
  completed: boolean;
  /** Whether the user marked this step as "no aplica" */
  skipped: boolean;
  /** Whether this step is effectively done (completed or skipped) */
  done: boolean;
}

export const STAGE_LABELS: Record<OnboardingStage, string> = {
  essential: 'Esencial',
  team: 'Equipo',
  operations: 'Operación',
  optional: 'Opcional',
};

export const STAGE_ORDER: OnboardingStage[] = ['essential', 'team', 'operations', 'optional'];
