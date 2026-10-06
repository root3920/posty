-- =============================================================
-- POSTY — Fix: Phase 3 migration had wrong column name
-- "room_number" does not exist on rooms table — the column is "number".
-- This caused the entire Phase 3 migration to fail, leaving
-- ALL constraints from that file unapplied.
--
-- This migration re-applies everything that was in Phase 3,
-- with the corrected column name.
-- =============================================================

-- Clean ALL data BEFORE adding constraints (Phase 3 original didn't run)
update public.guests set birth_date = null where birth_date > current_date;
update public.rooms set number = '1' where number = '0';
update public.room_types set max_adults = greatest(max_adults, 1) where max_adults < 1;
update public.room_types set max_adults = 50 where max_adults > 50;
update public.room_types set max_children = greatest(max_children, 0) where max_children < 0;
update public.room_types set max_children = 50 where max_children > 50;
update public.payments set amount = greatest(amount, 0.01) where amount <= 0;
update public.folio_charges set total = greatest(total, 0) where total < 0;

-- F3-6a: Guests birth_date must not be in the future
alter table public.guests
  drop constraint if exists chk_guests_birth_date;
alter table public.guests
  add constraint chk_guests_birth_date check (birth_date is null or birth_date <= current_date);

-- F3-6c: Room number must not be '0'
-- FIXED: column is "number", not "room_number"
alter table public.rooms
  drop constraint if exists chk_rooms_room_number_not_zero;
alter table public.rooms
  drop constraint if exists chk_rooms_number_not_zero;
alter table public.rooms
  add constraint chk_rooms_number_not_zero check (number != '0');

-- F3-6d: Room types — reasonable max capacity
alter table public.room_types
  drop constraint if exists chk_room_types_max_adults;
alter table public.room_types
  add constraint chk_room_types_max_adults check (max_adults >= 1 and max_adults <= 50);
alter table public.room_types
  drop constraint if exists chk_room_types_max_children;
alter table public.room_types
  add constraint chk_room_types_max_children check (max_children >= 0 and max_children <= 50);

-- F3-6e: Expenses — tax_amount >= 0
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name = 'tax_amount') then
    execute 'alter table public.expenses drop constraint if exists chk_expenses_tax_not_exceed';
    execute 'alter table public.expenses add constraint chk_expenses_tax_not_exceed check (tax_amount is null or tax_amount >= 0)';
  end if;
end;
$$;

-- F3-6f: Monetary amounts — reasonable upper bound
alter table public.payments
  drop constraint if exists chk_payments_reasonable_amount;
alter table public.payments
  add constraint chk_payments_reasonable_amount check (amount > 0 and amount < 100000000000);

alter table public.folio_charges
  drop constraint if exists chk_folio_charges_reasonable_total;
alter table public.folio_charges
  add constraint chk_folio_charges_reasonable_total check (total >= 0 and total < 100000000000);

-- =============================================================
-- Also: mark the failed Phase 3 migration as applied so
-- supabase doesn't try to re-run it (it would fail again
-- on the wrong column name). The user should run:
--   supabase migration repair --status applied 20261003100000
-- if db push complains about it.
-- =============================================================
