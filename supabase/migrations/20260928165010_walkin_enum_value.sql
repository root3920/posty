-- Add 'walk_in' to workflow_type enum
-- This must be in its own migration because ALTER TYPE ADD VALUE
-- cannot be used inside a transaction with other statements that
-- reference the new value.
alter type public.workflow_type add value if not exists 'walk_in';
