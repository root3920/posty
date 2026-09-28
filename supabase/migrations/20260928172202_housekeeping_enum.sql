-- =============================================================
-- POSTY — Housekeeping: extend housekeeping_status enum
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction
-- =============================================================

ALTER TYPE public.housekeeping_status ADD VALUE IF NOT EXISTS 'cleaning';
