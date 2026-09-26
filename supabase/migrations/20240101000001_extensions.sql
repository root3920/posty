-- =============================================================
-- POSTY — Migration: Enable required extensions
-- =============================================================

-- UUID generation
create extension if not exists "uuid-ossp" schema extensions;

-- For anti-double-booking exclusion constraint
create extension if not exists "btree_gist" schema extensions;
