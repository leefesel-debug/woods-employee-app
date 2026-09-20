-- Woods Team Hub — verified supplier cost update
-- 20 Sep 2026
-- Safe scope: COGS tables only. Does not touch allergens, users, training, orders or other Team Hub data.
-- This updates confirmed ingredient costs/yields and adds newly evidenced ingredients.
-- It does NOT replace menu items or wipe recipes. The only recipe additions are the missing bread roll on the three Batch items.

begin;

-- Existing core costs already established for Woods.
update public.cogs_ingredients set pack_cost=18.00, pack_qty=1000, unit='g' where id='coffee';
update public.cogs_ingredients set pack_cost=1.35, pack_qty=2000, unit='ml' where id='milk';
update public.cogs_ingredients set pack_cost=0.16, pack_qty=1, unit='each' where id='egg';
update public.cogs_ingredients set pack_cost=0.43, pack_qty=1, unit='each' where id='sausage';
update public.cogs_ingredients set pack_cost=0.30, pack_qty=1, unit='slice' where id='bacon';
update public.cogs_ingredients set pack_cost=7.49, pack_qty=2500, unit='g' where id='hash';

-- Delice de France.
-- XL White Pave with Sourdough: £32.96/case, 8 loaves/case, approx 15 usable portions/loaf = 120 portions.
update public.cogs_ingredients set pack_cost=32.96, pack_qty=120, unit='slice' where id='sourdough';
-- Plain California Bagel: £30.61/case, 56/case.
update public.cogs_ingredients set pack_cost=30.61, pack_qty=56, unit='each' where id='bagel-plain';
-- Multigrain California Bagel: £34.45/case, 56/case.
update public.cogs_ingredients set pack_cost=34.45, pack_qty=56, unit='each' where id='bagel-seeded';

-- John Dwyer: current invoices show 10% discount. Store the net/effective pack cost so recipes use the real Woods cost.
-- Focaccia £7.33 less 10% = £6.597/tray; established yield 4 portions/tray.
update public.cogs_ingredients set pack_cost=6.597, pack_qty=4, unit='portion' where id='focaccia';

-- Newly evidenced master-cost ingredients. Existing rows are updated only for cost/yield/unit/name.
insert into public.cogs_ingredients(id,name,unit,pack_cost,pack_qty,active)
values
 ('large-bap','Large white batch / bap','each',3.267,6,true),
 ('farmhouse-white','John Dwyer Large Farmhouse Sliced 800g','slice',2.196,null,true),
 ('farmhouse-wholemeal','John Dwyer Large Wholemeal Sliced 800g','slice',2.214,null,true),
 ('stuffed-cookie','Stuffed cookie','each',2.00,1,true),
 ('blondie','Blondie','each',2.25,1,true),
 ('brownie','Brownie','each',2.25,1,true),
 ('rocky-road','Rocky road','each',2.20,1,true),
 ('teacake','Sliced fruited teacake','each',35.32,48,true),
 ('maxi-croissant','Maxi croissant 120g','each',26.45,null,true)
on conflict (id) do update set
 name=excluded.name,
 unit=excluded.unit,
 pack_cost=excluded.pack_cost,
 pack_qty=excluded.pack_qty,
 active=true;

-- Batch sandwiches previously costed the filling but omitted the bread roll.
-- Add one John Dwyer large bap to each recipe without disturbing any other recipe lines.
insert into public.cogs_recipes(menu_item_id,ingredient_id,quantity)
select m.id,'large-bap',1
from public.cogs_menu_items m
where m.id in ('p-bacon-batch','p-sausage-batch','p-bacon-sausage-batch')
on conflict (menu_item_id,ingredient_id) do update set quantity=excluded.quantity;

commit;

-- Notes / outstanding yields:
-- 1. John Dwyer farmhouse white and wholemeal loaf prices are confirmed, but usable slices/loaf are not yet confirmed,
--    so pack_qty deliberately remains NULL and the app will show "Needs yield" rather than inventing a slice cost.
-- 2. Delice Maxi Croissant 120g case price is confirmed at £26.45, but case quantity is not confirmed, so it also remains "Needs yield".
-- 3. Aubrey Allen latest invoices show Cotswold sausage £7.86/kg and streaky bacon £12.19/kg. Woods' established per-piece
--    costs (£0.43 sausage / £0.30 bacon slice) remain in the live model until pieces/rashers per kg are confirmed.
-- 4. Brownie Addict unit prices exclude the £15 delivery charge on the supplied invoice. Delivery has not been arbitrarily
--    allocated across products because the landed unit cost changes with each order mix/quantity.
