-- Woods Team Hub · COGS supplier metadata
-- Run once in Supabase SQL Editor.

alter table public.cogs_ingredients
  add column if not exists supplier text,
  add column if not exists cost_basis text,
  add column if not exists last_checked text;

comment on column public.cogs_ingredients.supplier is 'Supplier used for the current ingredient cost';
comment on column public.cogs_ingredients.cost_basis is 'Pack price, yield or other evidence supporting the current cost';
comment on column public.cogs_ingredients.last_checked is 'Invoice/receipt date or other last-reviewed reference';
