create table if not exists public.table_bookings (
 id uuid primary key default gen_random_uuid(),
 customer_name text not null check (char_length(customer_name) between 1 and 120),
 booking_date date not null,
 booking_time time not null,
 contact_details text not null check (char_length(contact_details) between 1 and 200),
 party_size integer not null check (party_size between 1 and 50),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id),
 updated_by uuid references auth.users(id)
);
alter table public.table_bookings enable row level security;
drop policy if exists "Staff can read bookings" on public.table_bookings;
create policy "Staff can read bookings" on public.table_bookings for select to authenticated using (true);
drop policy if exists "Staff can add bookings" on public.table_bookings;
create policy "Staff can add bookings" on public.table_bookings for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "Creators and admins can update bookings" on public.table_bookings;
create policy "Creators and admins can update bookings" on public.table_bookings for update to authenticated
using (created_by = auth.uid() or public.is_admin())
with check (updated_by = auth.uid() and (created_by = auth.uid() or public.is_admin()));
drop policy if exists "Creators and admins can remove bookings" on public.table_bookings;
create policy "Creators and admins can remove bookings" on public.table_bookings for delete to authenticated
using (created_by = auth.uid() or public.is_admin());
create index if not exists table_bookings_date_time_idx on public.table_bookings (booking_date, booking_time);