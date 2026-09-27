-- =============================================================
-- POSTY — Phase 1: Extend workflow_type enum with all event types
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction.
-- =============================================================

ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'payment_confirmed';
ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'precheckin_sent';
ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'precheckin_completed';
ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'room_ready';
ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'in_house_daily';
ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'incident_created';
ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'night_audit';
ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'before_checkout';
ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'express_checkout_requested';
ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'checked_out';
ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'survey_answered';
ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'no_show_event';
ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'cancelled_event';
ALTER TYPE public.workflow_type ADD VALUE IF NOT EXISTS 'weekly';
