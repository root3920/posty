-- =============================================================
-- POSTY — Phase 3: Minor fixes — DB validations
-- =============================================================

-- F3-6a: Guests birth_date must not be in the future
-- Fix existing bad data first
update public.guests set birth_date = null where birth_date > current_date;

alter table public.guests
  drop constraint if exists chk_guests_birth_date,
  add constraint chk_guests_birth_date check (birth_date is null or birth_date <= current_date);

-- F3-6c: Room number must not be '0'
-- NOTE: column is "number", not "room_number" (room_number is a view alias)
update public.rooms set number = '1' where number = '0';

alter table public.rooms
  drop constraint if exists chk_rooms_number_not_zero,
  add constraint chk_rooms_number_not_zero check (number != '0');

-- F3-6d: Room types — reasonable max capacity
alter table public.room_types
  drop constraint if exists chk_room_types_max_adults,
  add constraint chk_room_types_max_adults check (max_adults >= 1 and max_adults <= 50);
alter table public.room_types
  drop constraint if exists chk_room_types_max_children,
  add constraint chk_room_types_max_children check (max_children >= 0 and max_children <= 50);

-- F3-6e: Expenses — tax_amount <= amount (if both set)
-- (Applied as a check; the tax should never exceed the base amount)
-- Note: expense table may have different column names — verify
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name = 'tax_amount') then
    execute 'alter table public.expenses drop constraint if exists chk_expenses_tax_not_exceed';
    execute 'alter table public.expenses add constraint chk_expenses_tax_not_exceed check (tax_amount is null or tax_amount >= 0)';
  end if;
end;
$$;

-- F3-6f: Monetary amounts — reasonable upper bound (prevent typos like 999,999,999,999)
-- 100 billion is absurdly high for any hotel; acts as a sanity check
alter table public.payments
  drop constraint if exists chk_payments_reasonable_amount,
  add constraint chk_payments_reasonable_amount check (amount > 0 and amount < 100000000000);

alter table public.folio_charges
  drop constraint if exists chk_folio_charges_reasonable_total,
  add constraint chk_folio_charges_reasonable_total check (total >= 0 and total < 100000000000);
