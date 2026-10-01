-- =============================================================
-- POSTY — Remove DIAN provider integration (keep internal taxes)
-- POSTY does NOT emit electronic invoices. Hotels use their own
-- billing system and register the invoice number in POSTY.
-- =============================================================

-- 1. Drop DIAN provider columns from organizations
alter table public.organizations
  drop column if exists dian_regime,
  drop column if exists dian_fiscal_responsibilities,
  drop column if exists dian_ciiu_code,
  drop column if exists dian_numbering_prefix,
  drop column if exists dian_numbering_from,
  drop column if exists dian_numbering_to,
  drop column if exists dian_numbering_current,
  drop column if exists dian_resolution_number,
  drop column if exists dian_resolution_date,
  drop column if exists dian_provider,
  drop column if exists dian_provider_api_key;

-- Keep: ica_rate, consumption_tax_rate (internal tax config)

-- 2. Drop invoice-related tables
drop table if exists public.invoice_lines cascade;
drop table if exists public.credit_notes cascade;
drop table if exists public.invoices cascade;

-- 3. Drop invoice sequence
drop sequence if exists public.invoice_number_seq;

-- 4. Drop invoice function
drop function if exists public.create_invoice_from_stay(uuid);

-- 5. Remove invoicing permissions
delete from public.role_permissions where permission_key like 'invoicing.%';
delete from public.permissions where module = 'invoicing';

-- 6. Add external_invoice_number to stays (for manual reference)
alter table public.stays
  add column if not exists external_invoice_number text;

-- 7. Add accommodation_iva_rate to organizations
alter table public.organizations
  add column if not exists accommodation_iva_rate numeric(5,2) not null default 19;
