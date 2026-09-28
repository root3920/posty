-- =============================================================
-- POSTY — Schema verification script
-- Run against the remote database to check that all expected
-- tables, columns, functions, triggers, views, and policies exist.
--
-- Usage: npx supabase db execute --file scripts/verify-schema.sql
-- Or paste into Supabase SQL Editor.
--
-- Returns rows ONLY for items that are MISSING.
-- An empty result means the schema is fully in sync.
-- =============================================================

-- -----------------------------------------------
-- 1. Expected tables and their key columns
-- -----------------------------------------------
WITH expected_columns(table_name, column_name) AS (VALUES
  -- Core
  ('organizations', 'id'), ('organizations', 'name'), ('organizations', 'country_code'),
  ('organizations', 'brand_color'), ('organizations', 'currency'), ('organizations', 'timezone'),
  ('profiles', 'id'), ('profiles', 'organization_id'), ('profiles', 'role_id'),
  ('roles', 'id'), ('roles', 'organization_id'), ('roles', 'system_key'),
  ('permissions', 'key'),
  ('role_permissions', 'role_id'), ('role_permissions', 'permission_key'),
  -- Catalogs
  ('task_statuses', 'id'), ('task_statuses', 'type'),
  ('room_statuses', 'id'), ('room_statuses', 'counts_as_available'),
  ('room_types', 'id'), ('room_types', 'base_rate'), ('room_types', 'max_adults'),
  ('document_types', 'id'), ('document_types', 'code'),
  ('booking_channels', 'id'), ('booking_channels', 'is_ota'),
  ('travel_reasons', 'id'), ('payment_methods', 'id'),
  ('revenue_centers', 'id'), ('expense_categories', 'id'),
  ('task_labels', 'id'),
  -- Team
  ('shift_templates', 'id'), ('work_schedules', 'id'), ('time_off', 'id'),
  -- Tasks
  ('tasks', 'id'), ('tasks', 'status_id'), ('tasks', 'stay_id'),
  ('tasks', 'template_id'), ('tasks', 'assigned_role_id'), ('tasks', 'phase'),
  ('tasks', 'source'), ('tasks', 'digest_date'),
  ('task_assignees', 'task_id'), ('task_comments', 'task_id'),
  ('task_label_links', 'task_id'),
  -- Task templates
  ('task_templates', 'id'), ('task_templates', 'workflow'), ('task_templates', 'phase'),
  ('task_templates', 'role_system_key'), ('task_templates', 'scope'), ('task_templates', 'anchor'),
  -- Hotel
  ('rooms', 'id'), ('rooms', 'room_type_id'), ('rooms', 'status_id'), ('rooms', 'housekeeping_status'),
  ('guests', 'id'), ('guests', 'document_type_id'),
  ('stays', 'id'), ('stays', 'room_id'), ('stays', 'primary_guest_id'), ('stays', 'status'),
  ('stay_guests', 'stay_id'),
  ('folio_charges', 'stay_id'), ('payments', 'stay_id'),
  -- History
  ('stay_status_history', 'id'), ('stay_status_history', 'stay_id'),
  ('stay_status_history', 'old_status'), ('stay_status_history', 'new_status'),
  -- Finance
  ('expenses', 'id'), ('other_revenue', 'id'), ('budgets', 'id')
)
SELECT 'MISSING COLUMN' as issue, e.table_name, e.column_name, null as detail
FROM expected_columns e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = e.table_name AND c.column_name = e.column_name
WHERE c.column_name IS NULL

UNION ALL

-- -----------------------------------------------
-- 2. Expected functions (RPCs)
-- -----------------------------------------------
SELECT 'MISSING FUNCTION' as issue, f.name as table_name, null as column_name, null as detail
FROM (VALUES
  ('current_org_id'), ('has_permission'), ('get_my_permissions'), ('get_my_profile'),
  ('seed_organization_defaults'), ('seed_default_task_templates'),
  ('ensure_workflow_roles'), ('generate_stay_tasks'), ('generate_arrived_tasks'),
  ('assign_task_to_best_person'), ('confirm_guest_arrival'),
  ('create_stay_with_auto_room'), ('available_rooms_by_type'),
  ('handle_updated_at')
) AS f(name)
LEFT JOIN pg_proc p ON p.proname = f.name AND p.pronamespace = 'public'::regnamespace
WHERE p.proname IS NULL

UNION ALL

-- -----------------------------------------------
-- 3. Expected views
-- -----------------------------------------------
SELECT 'MISSING VIEW' as issue, v.name as table_name, null as column_name, null as detail
FROM (VALUES
  ('stays_view'), ('tasks_view'), ('rooms_view'),
  ('expenses_view'), ('other_revenue_view'), ('stay_balances')
) AS v(name)
LEFT JOIN information_schema.views iv
  ON iv.table_schema = 'public' AND iv.table_name = v.name
LEFT JOIN information_schema.tables it
  ON it.table_schema = 'public' AND it.table_name = v.name AND it.table_type = 'VIEW'
WHERE iv.table_name IS NULL AND it.table_name IS NULL

UNION ALL

-- -----------------------------------------------
-- 4. Expected triggers
-- -----------------------------------------------
SELECT 'MISSING TRIGGER' as issue, t.trigger_table as table_name, t.trigger_name as column_name, null as detail
FROM (VALUES
  ('stays', 'on_stay_created'),
  ('stays', 'on_stay_cancelled'),
  ('stays', 'on_stay_dates_changed'),
  ('stays', 'on_stay_status_changed'),
  ('stays', 'on_stay_created_history'),
  ('profiles', 'on_profile_role_changed'),
  ('tasks', 'set_task_phase_from_template')
) AS t(trigger_table, trigger_name)
LEFT JOIN information_schema.triggers tr
  ON tr.trigger_schema = 'public'
  AND tr.event_object_table = t.trigger_table
  AND tr.trigger_name = t.trigger_name
WHERE tr.trigger_name IS NULL

UNION ALL

-- -----------------------------------------------
-- 5. RLS enabled on key tables
-- -----------------------------------------------
SELECT 'RLS DISABLED' as issue, t.table_name, null as column_name, null as detail
FROM (VALUES
  ('organizations'), ('profiles'), ('roles'), ('role_permissions'),
  ('rooms'), ('guests'), ('stays'), ('stay_guests'),
  ('folio_charges'), ('payments'), ('stay_status_history'),
  ('tasks'), ('task_assignees'), ('task_templates'),
  ('task_statuses'), ('room_statuses'), ('room_types'),
  ('document_types'), ('booking_channels'), ('travel_reasons'),
  ('payment_methods'), ('revenue_centers'), ('expense_categories'),
  ('task_labels'), ('expenses'), ('other_revenue'), ('budgets')
) AS t(table_name)
LEFT JOIN pg_tables pt ON pt.schemaname = 'public' AND pt.tablename = t.table_name
WHERE pt.tablename IS NULL OR pt.rowsecurity = false

ORDER BY 1, 2, 3;
