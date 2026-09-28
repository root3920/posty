-- =============================================================
-- POSTY — Fix: org country_code column (idempotent)
-- The original migration 20240101000016_org_country_code was
-- registered as applied but its SQL never executed on remote.
-- =============================================================

-- Add the column if it doesn't exist
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'CO';

-- Add a check constraint for 2-letter uppercase codes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_country_code_format'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT chk_country_code_format
      CHECK (country_code ~ '^[A-Z]{2}$');
  END IF;
END;
$$;
