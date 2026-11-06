-- Run in the Woods project before deploying the staff Quick Add button.
begin;
drop policy if exists "Admins can create products" on public.products;
drop policy if exists "Staff can create products" on public.products;

create policy "Staff can create products"
on public.products for insert to authenticated
with check (
  public.is_admin()
  or (
    active = true
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'staff'
    )
  )
);
commit;
