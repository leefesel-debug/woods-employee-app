-- Woods Team Hub: booking notes and amendments, pilot/staging rollout.
-- Run once in Supabase SQL Editor before using the new booking form.
-- Existing bookings and existing permissions are preserved.
alter table public.table_bookings
 add column if not exists special_requests text not null default '';

-- Guard against excessively long free-text notes.
do $$ begin
 if not exists (select 1 from pg_constraint where conname='table_bookings_special_requests_length') then
  alter table public.table_bookings add constraint table_bookings_special_requests_length
  check (char_length(special_requests) <= 1000);
 end if;
end $$;

-- Existing policy already allows UPDATE by booking creator or admin.
-- No additional permissions granted.
