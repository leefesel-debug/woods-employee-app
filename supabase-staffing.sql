-- Woods Team Hub — Staffing calendar
-- Run once in Supabase SQL Editor.

create table if not exists public.shop_staffing (
  shift_date date primary key,
  is_closed boolean not null default false,
  staff jsonb not null default '{}'::jsonb,
  opener text,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_staffing enable row level security;

drop policy if exists "staffing authenticated read" on public.shop_staffing;
create policy "staffing authenticated read"
on public.shop_staffing for select
to authenticated
using (true);

drop policy if exists "staffing authenticated insert" on public.shop_staffing;
create policy "staffing authenticated insert"
on public.shop_staffing for insert
to authenticated
with check (auth.uid() = created_by and auth.uid() = updated_by);

drop policy if exists "staffing authenticated update" on public.shop_staffing;
create policy "staffing authenticated update"
on public.shop_staffing for update
to authenticated
using (true)
with check (auth.uid() = updated_by);

drop policy if exists "staffing authenticated delete" on public.shop_staffing;
create policy "staffing authenticated delete"
on public.shop_staffing for delete
to authenticated
using (true);

create index if not exists shop_staffing_shift_date_idx on public.shop_staffing (shift_date);
