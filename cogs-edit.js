// COGS editing, archive and delete enhancements v3
// Remove erroneous seeded item for new sessions; migrate existing browser data too.
if(!data.menuCleanupV1){data.products=data.products.filter(p=>p.name!=='Smashed Avo Mini');data.menuCleanupV1=true;localStorage.setItem('woods-cogs-v4',JSON.stringify(data));}

// Cost evidence shown alongside the live Supabase values. This is display-only metadata;
// the actual calculation continues to use pack cost / pack quantity / unit from Supabase.
const COGS_COST_META={
 coffee:{supplier:'Monsoon Estates',basis:'£18.00 / 1kg',checked:'Previously established'},
 milk:{supplier:'Grocery supply',basis:'£1.35 / 2L',checked:'Previously established'},
 egg:{supplier:'Grocery supply',basis:'£0.16 each',checked:'Previously established'},
 sausage:{supplier:'Aubrey Allen',basis:'Current COGS uses established approx. £0.43 each; latest invoice £7.86/kg pending confirmed pieces/kg',checked:'09 Sep 2026 invoice'},
 bacon:{supplier:'Aubrey Allen',basis:'Current COGS uses established £0.30/slice; latest supplier credit £12.19/kg pending confirmed rashers/kg',checked:'01 Sep 2026 credit'},
 hash:{supplier:'Grocery supply',basis:'£7.49 / 2.5kg; recipe cost calculated by grams',checked:'Previously established'},
 sourdough:{supplier:'Delice de France',basis:'£32.96 case · 8 loaves · ~15 portions/loaf = 120 portions',checked:'18 Sep 2026 invoice'},
 'bagel-plain':{supplier:'Delice de France',basis:'£30.61 / 56 California bagels',checked:'21 Aug 2026 invoice'},
 'bagel-seeded':{supplier:'Delice de France',basis:'£34.45 / 56 multigrain California bagels',checked:'02 Sep 2026 invoice'},
 focaccia:{supplier:'John Dwyer',basis:'£7.33 tray less 10% discount = £6.597 · 4 portions',checked:'06 Sep 2026 invoice'},
 'large-bap':{supplier:'John Dwyer',basis:'£3.63 / 6 less 10% discount = £3.267 / 6',checked:'13 Sep 2026 invoice'},
 'farmhouse-white':{supplier:'John Dwyer',basis:'£2.44 loaf less 10% = £2.196; slice yield still required',checked:'13 Sep 2026 invoice'},
 'farmhouse-wholemeal':{supplier:'John Dwyer',basis:'£2.46 loaf less 10% = £2.214; slice yield still required',checked:'13 Sep 2026 invoice'},
 'stuffed-cookie':{supplier:'The Brownie Addict Bakery',basis:'£2.00 each',checked:'21 Jul 2026 invoice'},
 blondie:{supplier:'The Brownie Addict Bakery',basis:'£2.25 each',checked:'21 Jul 2026 invoice'},
 brownie:{supplier:'The Brownie Addict Bakery',basis:'£2.25 each',checked:'21 Jul 2026 invoice'},
 'rocky-road':{supplier:'The Brownie Addict Bakery',basis:'£2.20 each',checked:'21 Jul 2026 invoice'},
 teacake:{supplier:'Delice de France',basis:'£35.32 / 48 sliced fruited teacakes',checked:'18 Sep 2026 invoice'},
 'maxi-croissant':{supplier:'Delice de France',basis:'£26.45 case; case quantity still required',checked:'02 Sep 2026 invoice'}
};
function costMeta(id){return COGS_COST_META[id]||{supplier:'—',basis:'—',checked:'—'}}

let masterSearch='';
function filterMasterRows(value){
 masterSearch=String(value||'').trim().toLowerCase();
 const rows=[...document.querySelectorAll('#masterCostBody tr')];
 let shown=0;
 rows.forEach(row=>{const match=!masterSearch||(row.dataset.search||'').includes(masterSearch);row.style.display=match?'':'none';if(match)shown++});
 const count=document.getElementById('masterSearchCount');if(count)count.textContent=masterSearch?`${shown} of ${rows.length} shown`:`${rows.length} ingredients`;
}
function clearMasterSearch(){masterSearch='';ingredientsView();setTimeout(()=>document.getElementById('masterSearch')?.focus(),0)}

ingredientsView=function(){
 const sorted=data.ingredients.slice().sort((a,b)=>a.name.localeCompare(b.name));
 document.getElementById('panel').innerHTML=`<button class="primary" onclick="addIngredient()">+ Add Ingredient</button><p class="note">Enter the supplier pack cost and the usable quantity from that pack. Woods then calculates the unit cost automatically and every linked recipe updates. Supplier evidence below shows where confirmed costs came from; items marked <strong>Needs yield</strong> have a known pack price but still need the usable quantity confirmed.</p><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0"><input id="masterSearch" type="search" placeholder="Search ingredients or supplier…" value="${safe(masterSearch)}" oninput="filterMasterRows(this.value)" style="max-width:360px;width:min(100%,360px);flex:1"><button onclick="clearMasterSearch()">Clear</button><small id="masterSearchCount" class="note">${sorted.length} ingredients</small></div><div class="table"><table><thead><tr><th>Ingredient name</th><th>Pack cost £</th><th>Usable pack qty</th><th>Unit</th><th>Calculated unit cost</th><th>Supplier / cost basis</th><th></th></tr></thead><tbody id="masterCostBody">${sorted.map(i=>{const m=costMeta(i.id),status=i.packCost!=null&&i.packQty==null?'Needs yield':unit(i)==null?'Needs cost':money(unit(i))+' / '+safe(i.unit),search=safe(`${i.name} ${i.unit} ${m.supplier} ${m.basis} ${m.checked}`.toLowerCase());return `<tr data-search="${search}"><td><input type="text" value="${safe(i.name)}" onchange="editMaster('${i.id}','name',this.value)"></td><td><input type="number" step=".01" value="${i.packCost??''}" onchange="editMaster('${i.id}','packCost',this.value)"></td><td><input type="number" step=".01" value="${i.packQty??''}" onchange="editMaster('${i.id}','packQty',this.value)"></td><td><select onchange="editMaster('${i.id}','unit',this.value)">${['g','kg','ml','litre','each','slice','portion','bottle','can','pack'].map(u=>`<option ${i.unit===u?'selected':''}>${u}</option>`).join('')}</select></td><td><strong>${status}</strong></td><td><small><strong>${safe(m.supplier)}</strong><br>${safe(m.basis)}<br>${safe(m.checked)}</small></td><td><button onclick="deleteMaster('${i.id}')">Delete</button></td></tr>`}).join('')}</tbody></table></div>`;
 filterMasterRows(masterSearch);
};
function editMaster(id,key,value){const i=data.ingredients.find(x=>x.id===id);if(!i)return;if(key==='packCost'||key==='packQty')i[key]=value===''?null:Number(value);else i[key]=value.trim?value.trim():value;persist();ingredientsView()}
function deleteMaster(id){const i=data.ingredients.find(x=>x.id===id);if(!i)return;const used=data.products.filter(p=>(p.recipe||[]).some(r=>r.ingredientId===id));if(used.length){alert(`${i.name} is used in ${used.length} menu item${used.length===1?'':'s'}. Remove it from those recipes before deleting it.`);return}if(confirm(`Delete ${i.name} from the master cost list?`)){data.ingredients=data.ingredients.filter(x=>x.id!==id);persist();render()}}
function persist(){localStorage.setItem('woods-cogs-v4',JSON.stringify(data));}

// Override the menu category view to include item maintenance controls and profitability.
categoryView=function(){
 const ps=data.products.filter(p=>p.category===selectedCategory&&!p.archived);
 document.getElementById('panel').innerHTML=`<p><button onclick="view='categories';render()">← All categories</button> <button onclick="archivedView()">Archived Items (${data.products.filter(p=>p.archived).length})</button></p><h2>${safe(selectedCategory)}</h2><div class="cards">${ps.map(p=>{const c=cost(p),pct=p.price&&!c.incomplete?c.total/p.price*100:null,g=p.price&&!c.incomplete?p.price-c.total:null,margin=p.price&&g!=null?g/p.price*100:null;return `<article><b>${safe(p.name)}</b><p>Selling price: ${money(p.price)}<br>Total recipe cost: <strong>${c.incomplete?'Needs costs':money(c.total)}</strong><br>Food cost / COGS: <strong>${pct==null?'—':pct.toFixed(1)+'%'}</strong><br>Gross contribution: ${g==null?'—':money(g)}<br>Gross margin: <strong>${margin==null?'—':margin.toFixed(1)+'%'}</strong></p><button onclick="editRecipe('${p.id}')">Recipe</button> <button onclick="editMenuItem('${p.id}')">Edit</button> <button onclick="archiveMenuItem('${p.id}')">Archive</button> <button onclick="deleteMenuItem('${p.id}')">Delete</button></article>`}).join('')||'<p>No active items in this category.</p>'}</div>`;
};

function editMenuItem(id){const p=data.products.find(x=>x.id===id);if(!p)return;const name=prompt('Menu item name',p.name);if(name===null||!name.trim())return;const price=prompt('Selling price (£)',p.price);if(price===null)return;const category=prompt('Category',p.category);if(category===null||!category.trim())return;p.name=name.trim();p.price=Number(price)||0;p.category=category.trim();if(!data.categories.includes(p.category))data.categories.push(p.category);persist();selectedCategory=p.category;view='category';render()}
function archiveMenuItem(id){const p=data.products.find(x=>x.id===id);if(!p)return;if(confirm(`Archive ${p.name}? It will leave the active menu but its recipe and costing will be retained.`)){p.archived=true;p.archivedAt=new Date().toISOString();persist();render()}}
function restoreMenuItem(id){const p=data.products.find(x=>x.id===id);if(!p)return;p.archived=false;delete p.archivedAt;persist();archivedView()}
function deleteMenuItem(id){const p=data.products.find(x=>x.id===id);if(!p)return;if(confirm(`Permanently delete ${p.name}? This cannot be undone.`)){data.products=data.products.filter(x=>x.id!==id);persist();render()}}
function archivedView(){
 const ps=data.products.filter(p=>p.archived).sort((a,b)=>a.name.localeCompare(b.name));
 document.getElementById('panel').innerHTML=`<p><button onclick="view='categories';render()">← Categories</button></p><h2>Archived Items</h2><p class="note">Archived items are kept for historical reference but do not appear in active menu categories.</p><div class="cards">${ps.map(p=>`<article><b>${safe(p.name)}</b><p>${safe(p.category)} · ${money(p.price)}</p><button onclick="editRecipe('${p.id}')">Recipe</button> <button onclick="restoreMenuItem('${p.id}')">Restore</button> <button onclick="deleteMenuItem('${p.id}')">Delete permanently</button></article>`).join('')||'<p>No archived items.</p>'}</div>`;
}

// Make category dashboard counts active items only and count an item as complete only when it has both a full recipe cost and a selling price.
categories=function(){document.getElementById('panel').innerHTML=`<p><button onclick="archivedView()">Archived Items (${data.products.filter(p=>p.archived).length})</button></p><div class="cards">${data.categories.map(c=>{const ps=data.products.filter(p=>p.category===c&&!p.archived),done=ps.filter(p=>!cost(p).incomplete&&Number(p.price)>0).length;return `<article onclick="openCategory('${c.replace(/'/g,"\\'")}')" style="cursor:pointer"><b>${safe(c)}</b><p>${ps.length} active items · ${done} fully costed</p><button>Open category</button></article>`}).join('')}</div><p class="note">Open a category to see each active item's selling price, total recipe cost, COGS, gross contribution and gross margin.</p>`};