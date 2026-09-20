// Woods COGS editable supplier metadata v1
// Extends the master cost list so supplier evidence is maintained with each ingredient.

const COGS_META_DEFAULTS={
 coffee:{supplier:'Monsoon Estates',costBasis:'£18.00 / 1kg',lastChecked:'Previously established'},
 milk:{supplier:'Grocery supply',costBasis:'£1.35 / 2L',lastChecked:'Previously established'},
 egg:{supplier:'Grocery supply',costBasis:'£0.16 each',lastChecked:'Previously established'},
 sausage:{supplier:'Aubrey Allen',costBasis:'Current COGS uses established approx. £0.43 each; latest invoice £7.86/kg pending confirmed pieces/kg',lastChecked:'09 Sep 2026 invoice'},
 bacon:{supplier:'Aubrey Allen',costBasis:'Current COGS uses established £0.30/slice; latest supplier credit £12.19/kg pending confirmed rashers/kg',lastChecked:'01 Sep 2026 credit'},
 hash:{supplier:'Grocery supply',costBasis:'£7.49 / 2.5kg; recipe cost calculated by grams',lastChecked:'Previously established'},
 sourdough:{supplier:'Delice de France',costBasis:'£32.96 case · 8 loaves · ~15 portions/loaf = 120 portions',lastChecked:'18 Sep 2026 invoice'},
 'bagel-plain':{supplier:'Delice de France',costBasis:'£30.61 / 56 California bagels',lastChecked:'21 Aug 2026 invoice'},
 'bagel-seeded':{supplier:'Delice de France',costBasis:'£34.45 / 56 multigrain California bagels',lastChecked:'02 Sep 2026 invoice'},
 focaccia:{supplier:'John Dwyer',costBasis:'£7.33 tray less 10% discount = £6.597 · 4 portions',lastChecked:'06 Sep 2026 invoice'},
 'large-bap':{supplier:'John Dwyer',costBasis:'£3.63 / 6 less 10% discount = £3.267 / 6',lastChecked:'13 Sep 2026 invoice'},
 'farmhouse-white':{supplier:'John Dwyer',costBasis:'£2.44 loaf less 10% = £2.196; slice yield still required',lastChecked:'13 Sep 2026 invoice'},
 'farmhouse-wholemeal':{supplier:'John Dwyer',costBasis:'£2.46 loaf less 10% = £2.214; slice yield still required',lastChecked:'13 Sep 2026 invoice'},
 'stuffed-cookie':{supplier:'The Brownie Addict Bakery',costBasis:'£2.00 each',lastChecked:'21 Jul 2026 invoice'},
 blondie:{supplier:'The Brownie Addict Bakery',costBasis:'£2.25 each',lastChecked:'21 Jul 2026 invoice'},
 brownie:{supplier:'The Brownie Addict Bakery',costBasis:'£2.25 each',lastChecked:'21 Jul 2026 invoice'},
 'rocky-road':{supplier:'The Brownie Addict Bakery',costBasis:'£2.20 each',lastChecked:'21 Jul 2026 invoice'},
 teacake:{supplier:'Delice de France',costBasis:'£35.32 / 48 sliced fruited teacakes',lastChecked:'18 Sep 2026 invoice'},
 'maxi-croissant':{supplier:'Delice de France',costBasis:'£26.45 case; case quantity still required',lastChecked:'02 Sep 2026 invoice'}
};

function editableCostMeta(i){
 const d=COGS_META_DEFAULTS[i.id]||{};
 return {
  supplier:i.supplier??d.supplier??'',
  costBasis:i.costBasis??d.costBasis??'',
  lastChecked:i.lastChecked??d.lastChecked??''
 };
}

// Keep search compatible with the existing master-list search helper.
costMeta=function(id){
 const i=data.ingredients.find(x=>x.id===id)||{id};
 const m=editableCostMeta(i);
 return {supplier:m.supplier,basis:m.costBasis,checked:m.lastChecked};
};

function editSupplierMeta(id,key,value){
 const i=data.ingredients.find(x=>x.id===id);if(!i)return;
 i[key]=String(value??'').trim();
 persist();
 // Do not redraw while typing; onchange saves when the field is left.
 const count=document.getElementById('masterSearchCount');
 if(count)count.textContent='Saved';
}

ingredientsView=function(){
 const sorted=data.ingredients.slice().sort((a,b)=>a.name.localeCompare(b.name));
 document.getElementById('panel').innerHTML=`<button class="primary" onclick="addIngredient()">+ Add Ingredient</button><p class="note">Enter the supplier pack cost and usable quantity. Woods calculates the unit cost automatically and linked recipes update. Supplier, cost basis and last checked are editable and saved to the shared COGS data.</p><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0"><input id="masterSearch" type="search" placeholder="Search ingredients or supplier…" value="${safe(masterSearch)}" oninput="filterMasterRows(this.value)" style="max-width:360px;width:min(100%,360px);flex:1"><button onclick="clearMasterSearch()">Clear</button><small id="masterSearchCount" class="note">${sorted.length} ingredients</small></div><div class="table"><table><thead><tr><th>Ingredient name</th><th>Pack cost £</th><th>Usable pack qty</th><th>Unit</th><th>Calculated unit cost</th><th>Supplier / cost basis</th><th></th></tr></thead><tbody id="masterCostBody">${sorted.map(i=>{const m=editableCostMeta(i),status=i.packCost!=null&&i.packQty==null?'Needs yield':unit(i)==null?'Needs cost':money(unit(i))+' / '+safe(i.unit),search=safe(`${i.name} ${i.unit} ${m.supplier} ${m.costBasis} ${m.lastChecked}`.toLowerCase());return `<tr data-search="${search}"><td><input type="text" value="${safe(i.name)}" onchange="editMaster('${i.id}','name',this.value)"></td><td><input type="number" step=".01" value="${i.packCost??''}" onchange="editMaster('${i.id}','packCost',this.value)"></td><td><input type="number" step=".01" value="${i.packQty??''}" onchange="editMaster('${i.id}','packQty',this.value)"></td><td><select onchange="editMaster('${i.id}','unit',this.value)">${['g','kg','ml','litre','each','slice','portion','bottle','can','pack'].map(u=>`<option ${i.unit===u?'selected':''}>${u}</option>`).join('')}</select></td><td><strong>${status}</strong></td><td><div style="display:grid;gap:6px;min-width:260px"><input type="text" placeholder="Supplier" value="${safe(m.supplier)}" onchange="editSupplierMeta('${i.id}','supplier',this.value)" style="max-width:none;width:100%"><textarea placeholder="Cost basis / notes" onchange="editSupplierMeta('${i.id}','costBasis',this.value)" style="border:1px solid var(--l);border-radius:8px;padding:9px;font:inherit;min-height:66px;resize:vertical;width:100%">${safe(m.costBasis)}</textarea><input type="text" placeholder="Last checked e.g. 20 Sep 2026 invoice" value="${safe(m.lastChecked)}" onchange="editSupplierMeta('${i.id}','lastChecked',this.value)" style="max-width:none;width:100%"></div></td><td><button onclick="deleteMaster('${i.id}')">Delete</button></td></tr>`}).join('')}</tbody></table></div>`;
 filterMasterRows(masterSearch);
};
