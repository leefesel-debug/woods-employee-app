-- Woods Team Hub: shared allergen data
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'staff' check (role in ('staff','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default '',
  allergens text[] not null default '{}',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.product_audit (
  id bigint generated always as identity primary key,
  product_id uuid,
  action text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id),
  previous_data jsonb,
  new_data jsonb
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.audit_product_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.product_audit(product_id,action,changed_by,new_data)
    values(new.id,'created',auth.uid(),to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    new.updated_at = now();
    new.updated_by = auth.uid();
    insert into public.product_audit(product_id,action,changed_by,previous_data,new_data)
    values(new.id,case when old.active and not new.active then 'archived' else 'updated' end,auth.uid(),to_jsonb(old),to_jsonb(new));
    return new;
  else
    insert into public.product_audit(product_id,action,changed_by,previous_data)
    values(old.id,'deleted',auth.uid(),to_jsonb(old));
    return old;
  end if;
end $$;

drop trigger if exists products_audit_trigger on public.products;
create trigger products_audit_trigger
before insert or update or delete on public.products
for each row execute function public.audit_product_change();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_audit enable row level security;

create policy "Signed-in staff can read active products"
on public.products for select to authenticated
using (active = true or public.is_admin());

create policy "Admins can create products"
on public.products for insert to authenticated
with check (public.is_admin());

create policy "Admins can update products"
on public.products for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete products"
on public.products for delete to authenticated
using (public.is_admin());

create policy "Users can read their profile"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "Admins can manage profiles"
on public.profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins can read audit history"
on public.product_audit for select to authenticated
using (public.is_admin());
