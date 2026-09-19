// Woods Team Hub — COGS module v1
// Admin-only menu costing workspace. Data persists locally until Supabase tables are added.
const WOODS_COGS_SEED={
 ingredients:[
  {id:'coffee',name:'Coffee beans',packCost:18,packQty:1000,unit:'g'},
  {id:'milk',name:'Whole milk',packCost:1.35,packQty:2000,unit:'ml'},
  {id:'egg',name:'Egg',packCost:.16,packQty:1,unit:'each'},
  {id:'sausage',name:'Sausage',packCost:.43,packQty:1,unit:'each'},
  {id:'bacon',name:'Bacon',packCost:.30,packQty:1,unit:'slice'},
  {id:'hash',name:'Potato pops / hash browns',packCost:7.49,packQty:2500,unit:'g'},
  {id:'syrup-caramel',name:'Caramel syrup',packCost:null,packQty:null,unit:'ml'},
  {id:'syrup-vanilla',name:'Vanilla syrup',packCost:null,packQty:null,unit:'ml'},
  {id:'syrup-hazelnut',name:'Hazelnut syrup',packCost:null,packQty:null,unit:'ml'},
  {id:'milk-oat',name:'Oat milk',packCost:null,packQty:null,unit:'ml'},
  {id:'milk-almond',name:'Almond milk',packCost:null,packQty:null,unit:'ml'},
  {id:'milk-soya',name:'Soya milk',packCost:null,packQty:null,unit:'ml'}
 ],
 products:[
  ['Espresso','Drinks',2.90],['Americano - Black','Drinks',3.20],['Americano - White','Drinks',3.50],['Cappuccino','Drinks',3.70],['Cortado','Drinks',3.30],['Flat White','Drinks',3.70],['Latte','Drinks',3.70],['Mocha','Drinks',3.90],['Matcha Latte','Drinks',null],['Special Lattes','Drinks',4.50],['Tea - Earl Grey','Drinks',3.00],['Tea - English Breakfast','Drinks',3.00],['Dragon fruit and Mango Refresher','Cold drinks',4.50],['Peach and Mango Refresher','Cold drinks',4.50],['Strawberry and Mango Refresher','Cold drinks',4.50],['Coke','Cold drinks',2.00],['Diet Coke','Cold drinks',2.00],['Fanta','Cold drinks',2.00],['Sprite','Cold drinks',2.00],['Vimto','Cold drinks',2.00],['Red Bull','Cold drinks',2.20],['Fentimans Lemonade','Cold drinks',2.50],['Fentimans Dandelion & Burdock','Cold drinks',2.50],['Posh Pop','Cold drinks',3.50],['Fruit Shoot','Cold drinks',1.00],['Orange Juice','Cold drinks',2.90],['Apple Juice','Cold drinks',2.90],['Still Water','Cold drinks',2.50],['Sparkling Water','Cold drinks',2.50]
 ].map((x,i)=>({id:'p'+i,name:x[0],category:x[1],price:x[2],recipe:[]})),
 addons:[
  {name:'Caramel syrup',price:.50},{name:'Vanilla syrup',price:.50},{name:'Hazelnut syrup',price:.50},
  {name:'Almond milk',price:.50},{name:'Oat milk',price:.50},{name:'Soya milk',price:.50}
 ]
};
function cogsMoney(n){return Number.isFinite(Number(n))?'£'+Number(n).toFixed(2):'—'}
function cogsLoad(){try{return JSON.parse(localStorage.getItem('woods-cogs-v1'))||structuredClone(WOODS_COGS_SEED)}catch{return structuredClone(WOODS_COGS_SEED)}}
function cogsSave(){localStorage.setItem('woods-cogs-v1',JSON.stringify(window.woodsCogs));renderCogs()}
function cogsUnitCost(i){return Number(i.packCost)&&Number(i.packQty)?Number(i.packCost)/Number(i.packQty):null}
function cogsProductCost(p){let incomplete=false,total=0;(p.recipe||[]).forEach(r=>{const i=woodsCogs.ingredients.find(x=>x.id===r.ingredientId),u=i&&cogsUnitCost(i);if(u==null)incomplete=true;else total+=u*Number(r.qty||0)});return{total,incomplete}}
function cogsTone(p){const c=cogsProductCost(p);if(c.incomplete||!p.price)return'incomplete';const pct=c.total/p.price*100;return pct<=30?'good':pct<=35?'watch':'high'}
function renderCogs(){
 const root=document.getElementById('cogsRoot');if(!root)return;if(!isAdmin){root.innerHTML='<div class="empty"><strong>Admin access required.</strong></div>';return}
 const complete=woodsCogs.products.filter(p=>!cogsProductCost(p).incomplete&&p.recipe.length&&p.price).length;
 root.innerHTML=`<div class="cogs-summary"><div class="cogs-kpi"><small>Menu items</small><strong>${woodsCogs.products.length}</strong></div><div class="cogs-kpi"><small>Fully costed</small><strong>${complete}</strong></div><div class="cogs-kpi"><small>Ingredients</small><strong>${woodsCogs.ingredients.length}</strong></div></div>
 <div class="cogs-tabs"><button class="btn primary" onclick="cogsPanel('menu')">Menu costing</button><button class="btn" onclick="cogsPanel('ingredients')">Ingredients</button><button class="btn" onclick="cogsPanel('addons')">Add-ons</button></div><div id="cogsPanel"></div>`;cogsPanel('menu')
}
function cogsPanel(which){const el=document.getElementById('cogsPanel');if(!el)return;if(which==='ingredients')return cogsIngredients(el);if(which==='addons')return cogsAddons(el);cogsMenu(el)}
function cogsMenu(el){el.innerHTML=`<div class="cogs-table-wrap"><table class="cogs-table"><thead><tr><th>Item</th><th>Category</th><th>Selling price</th><th>Recipe cost</th><th>COGS</th><th>Gross contribution</th><th>Status</th></tr></thead><tbody>${woodsCogs.products.map(p=>{const c=cogsProductCost(p),pct=p.price&&!c.incomplete?c.total/p.price*100:null,gp=p.price&&!c.incomplete?p.price-c.total:null;return `<tr><td><strong>${safe(p.name)}</strong></td><td>${safe(p.category)}</td><td><input class="cogs-price" type="number" step=".01" value="${p.price??''}" onchange="cogsPrice('${p.id}',this.value)"></td><td>${c.incomplete||!p.recipe.length?'—':cogsMoney(c.total)}</td><td>${pct==null?'—':pct.toFixed(1)+'%'}</td><td>${gp==null?'—':cogsMoney(gp)}</td><td><span class="cogs-status ${cogsTone(p)}">${cogsTone(p)==='good'?'On target':cogsTone(p)==='watch'?'Watch':cogsTone(p)==='high'?'High':'Needs costing'}</span></td></tr>`}).join('')}</tbody></table></div><p class="notes">Recipe builder is the next step: ingredient quantities will drive these live costs. Green ≤30%, amber 30–35%, red &gt;35%.</p>`}
function cogsIngredients(el){el.innerHTML=`<div class="cogs-table-wrap"><table class="cogs-table"><thead><tr><th>Ingredient</th><th>Pack cost</th><th>Pack size</th><th>Unit</th><th>Unit cost</th></tr></thead><tbody>${woodsCogs.ingredients.map(i=>`<tr><td><strong>${safe(i.name)}</strong></td><td><input class="cogs-price" type="number" step=".01" value="${i.packCost??''}" onchange="cogsIngredient('${i.id}','packCost',this.value)"></td><td><input class="cogs-price" type="number" step=".01" value="${i.packQty??''}" onchange="cogsIngredient('${i.id}','packQty',this.value)"></td><td>${safe(i.unit)}</td><td>${cogsUnitCost(i)==null?'Needs cost':cogsMoney(cogsUnitCost(i))+' / '+safe(i.unit)}</td></tr>`).join('')}</tbody></table></div>`}
function cogsAddons(el){el.innerHTML=`<div class="grid">${woodsCogs.addons.map((a,i)=>`<article class="card"><h2>${safe(a.name)}</h2><div class="category">Customer supplement</div><p><strong>${cogsMoney(a.price)}</strong></p><label class="field"><span>Selling price</span><input type="number" step=".01" value="${a.price}" onchange="woodsCogs.addons[${i}].price=Number(this.value);cogsSave()"></label></article>`).join('')}</div>`}
function cogsPrice(id,v){const p=woodsCogs.products.find(x=>x.id===id);if(p){p.price=v===''?null:Number(v);cogsSave()}}
function cogsIngredient(id,k,v){const i=woodsCogs.ingredients.find(x=>x.id===id);if(i){i[k]=v===''?null:Number(v);cogsSave()}}
window.woodsCogs=cogsLoad();
