-- Woods Team Hub — Gainsborough Chilled Foods COGS update
-- Evidence: Woods receipts dated 21 Aug, 28 Aug, 4 Sep and 11 Sep 2026.
-- Safe scope: public.cogs_ingredients only. No allergen, login, training or other Team Hub tables are touched.

begin;

-- Items already used in Woods recipes. Quantities match the recipe units already used by the app.
update public.cogs_ingredients set pack_cost=3.50, pack_qty=2620, unit='g' where id='beans';
update public.cogs_ingredients set pack_cost=20.98, pack_qty=34, unit='each' where id='veggie-sausage';
update public.cogs_ingredients set pack_cost=2.71, pack_qty=250, unit='g' where id='halloumi';
update public.cogs_ingredients set pack_cost=9.69, pack_qty=2000, unit='g' where id='cheese';
update public.cogs_ingredients set pack_cost=5.63, pack_qty=1000, unit='g' where id='tuna';
update public.cogs_ingredients set pack_cost=9.56, pack_qty=5000, unit='ml' where id='mayo';
update public.cogs_ingredients set pack_cost=28.16, pack_qty=120, unit='each' where id='pancakes';

-- Ham is sold as a 500g pack but Woods recipes currently specify ham by slice.
-- Record the confirmed pack price but deliberately leave usable slice yield blank until slices/pack are counted.
update public.cogs_ingredients set pack_cost=4.51, pack_qty=null, unit='slice' where id='ham';

-- Puddings are accurately costable by weight from the receipt. They are not currently linked to a seeded recipe.
update public.cogs_ingredients set pack_cost=3.00, pack_qty=1360, unit='g' where id='black-pudding';
update public.cogs_ingredients set pack_cost=3.02, pack_qty=500, unit='g' where id='white-pudding';

-- Panini bread evidenced as 30 for £9.70. Added to the master list only; not linked to Toastie / Panini yet
-- because fillings still need to be defined and linking only the bread would incorrectly make the menu item look fully costed.
insert into public.cogs_ingredients(id,name,unit,pack_cost,pack_qty,active)
values ('panini-bread','Grill Mark Panini','each',9.70,30,true)
on conflict (id) do update set name=excluded.name,unit=excluded.unit,pack_cost=excluded.pack_cost,pack_qty=excluded.pack_qty,active=true;

commit;

-- Confirmed calculated costs after this update:
-- Beans: £0.001336/g; 100g = £0.134; 200g = £0.267.
-- Quorn vegan sausage: £0.617 each; 2 = £1.234.
-- Halloumi: £0.01084/g; 80g = £0.867.
-- Mature grated cheese: £0.004845/g; 30g = £0.145; 40g = £0.194; 60g = £0.291.
-- Tuna: £0.00563/g; 80g = £0.450.
-- Mayo: £0.001912/ml; 20ml = £0.038.
-- Buttermilk pancake: £0.2347 each; stack of 3 = £0.704.
-- Black pudding: £0.002206/g.
-- White pudding: £0.00604/g.
-- Panini bread: £0.323 each.
-- Ham: £4.51/500g pack known; slice yield still required.
-- Prime back bacon is £11.69/2.27kg on Gainsborough receipts, but the live Woods recipes use bacon by slice.
-- Existing £0.30/slice is therefore retained until rashers/pack or average rasher weight is confirmed.
