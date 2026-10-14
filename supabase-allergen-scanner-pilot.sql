-- Pilot-only allergen scanning review queue. Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.allergen_scan_drafts (
 id uuid primary key default gen_random_uuid(),
 product_id uuid references public.products(id) on delete set null,
 product_name text not null check (char_length(product_name) between 1 and 200),
 category text not null default '',
 contains_allergens text[] not null default '{}',
 may_contain_allergens text[] not null default '{}',
 raw_label_text text not null check (char_length(raw_label_text) <= 15000),
 review_notes text not null default '',
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 submitted_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz
);
create index if not exists allergen_scan_drafts_status_created_idx on public.allergen_scan_drafts(status,created_at desc);
alter table public.allergen_scan_drafts enable row level security;
drop policy if exists "Scan submitters and admins can read drafts" on public.allergen_scan_drafts;
create policy "Scan submitters and admins can read drafts" on public.allergen_scan_drafts
 for select to authenticated using (submitted_by=auth.uid() or public.is_admin());
drop policy if exists "Signed-in staff can submit scan drafts" on public.allergen_scan_drafts;
create policy "Signed-in staff can submit scan drafts" on public.allergen_scan_drafts
 for insert to authenticated with check (
 submitted_by=auth.uid() and status='pending' and reviewed_by is null and reviewed_at is null
 );
drop policy if exists "Only admins can review scan drafts" on public.allergen_scan_drafts;
create policy "Only admins can review scan drafts" on public.allergen_scan_drafts
 for update to authenticated using (public.is_admin())
 with check (public.is_admin());
-- No DELETE policy: retain review history.
-- Existing public.products audit trigger records the eventual admin-approved product update.
