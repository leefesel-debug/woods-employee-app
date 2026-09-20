// Woods COGS Supabase adapter v3 — admin restricted
const cogsCfg=window.WOODS_CONFIG||{};
const cogsDb=window.supabase?.createClient(cogsCfg.supabaseUrl,cogsCfg.supabaseAnonKey);
let cogsUser=null,cogsRemoteReady=false,cogsSyncing=false;

function remoteShape(){return {
 ingredients:data.ingredients.map(i=>({id:i.id,name:i.name,unit:i.unit||'each',pack_cost:i.packCost==null?null:Number(i.packCost),pack_qty:i.packQty==null?null:Number(i.packQty),active:i.active!==false})),
 menu:data.products.map((p,n)=>({id:p.id,name:p.name,category:p.category,selling_price:Number(p.price)||0,active:!p.archived,sort_order:n})),
 recipes:data.products.flatMap(p=>(p.recipe||[]).map(r=>({menu_item_id:p.id,ingredient_id:r.ingredientId,quantity:Number(r.qty)||1}))),
 addons:data.addons.map(a=>({name:a.name,selling_price:Number(a.price)||0,active:a.active!==false}))
}}
function localShape(ings,menu,recipes,addons){
 const recipeMap={};recipes.forEach(r=>(recipeMap[r.menu_item_id]??=[]).push({ingredientId:r.ingredient_id,qty:Number(r.quantity)}));
 return {ingredients:ings.map(i=>({id:i.id,name:i.name,unit:i.unit,packCost:i.pack_cost==null?null:Number(i.pack_cost),packQty:i.pack_qty==null?null:Number(i.pack_qty),active:i.active})),products:menu.map(p=>({id:p.id,name:p.name,category:p.category,price:Number(p.selling_price),archived:!p.active,recipe:recipeMap[p.id]||[]})),addons:addons.map(a=>({name:a.name,price:Number(a.selling_price),active:a.active})),categories:[...new Set([...WOODS_COGS_SEED.categories,...menu.map(p=>p.category)])],menuCleanupV1:true};
}
async function cogsLoadRemote(){
 if(!cogsDb||!cogsUser)return false;
 const [a,b,c,d]=await Promise.all([cogsDb.from('cogs_ingredients').select('*').order('name'),cogsDb.from('cogs_menu_items').select('*').order('sort_order').order('name'),cogsDb.from('cogs_recipes').select('*'),cogsDb.from('cogs_addons').select('*').order('name')]);
 const err=a.error||b.error||c.error||d.error;if(err)throw err;
 if(!a.data.length&&!b.data.length){await cogsSeedRemote();return cogsLoadRemote()}
 data=localShape(a.data,b.data,c.data,d.data);localStorage.setItem('woods-cogs-v4',JSON.stringify(data));cogsRemoteReady=true;return true;
}
async function cogsSeedRemote(){
 const s=remoteShape();
 let q=await cogsDb.from('cogs_ingredients').upsert(s.ingredients);if(q.error)throw q.error;
 q=await cogsDb.from('cogs_menu_items').upsert(s.menu);if(q.error)throw q.error;
 if(s.recipes.length){q=await cogsDb.from('cogs_recipes').upsert(s.recipes,{onConflict:'menu_item_id,ingredient_id'});if(q.error)throw q.error}
 if(s.addons.length){q=await cogsDb.from('cogs_addons').upsert(s.addons,{onConflict:'name'});if(q.error)throw q.error}
}
async function cogsDeleteMissingIngredients(localIngredients){
 const remote=await cogsDb.from('cogs_ingredients').select('id');if(remote.error)throw remote.error;
 const keep=new Set(localIngredients.map(i=>i.id));
 const stale=(remote.data||[]).map(i=>i.id).filter(id=>!keep.has(id));
 for(const id of stale){
  const q=await cogsDb.from('cogs_ingredients').delete().eq('id',id);if(q.error)throw q.error;
 }
}
async function cogsPushRemote(){
 if(!cogsRemoteReady||cogsSyncing||!cogsUser)return;
 cogsSyncing=true;
 try{
  const s=remoteShape();
  let q=await cogsDb.from('cogs_ingredients').upsert(s.ingredients);if(q.error)throw q.error;
  q=await cogsDb.from('cogs_menu_items').upsert(s.menu);if(q.error)throw q.error;
  const ids=s.menu.map(x=>x.id);if(ids.length){q=await cogsDb.from('cogs_recipes').delete().in('menu_item_id',ids);if(q.error)throw q.error}
  if(s.recipes.length){q=await cogsDb.from('cogs_recipes').insert(s.recipes);if(q.error)throw q.error}
  // Reconcile master ingredients as well as upserting them. Previously a deleted
  // browser row was never deleted from Supabase, so it reappeared on refresh.
  await cogsDeleteMissingIngredients(s.ingredients);
  for(const a of s.addons){q=await cogsDb.from('cogs_addons').upsert(a,{onConflict:'name'});if(q.error)throw q.error}
  cogsBanner('Saved to Supabase','ok');
 }catch(e){console.error(e);cogsBanner('Save failed: '+(e.message||e),'error')}finally{cogsSyncing=false}
}
function cogsBanner(text,tone=''){let el=document.getElementById('cogsSync');if(!el){el=document.createElement('p');el.id='cogsSync';el.className='note';document.querySelector('.hero')?.appendChild(el)}el.textContent=text;el.style.color=tone==='error'?'#8a1c13':tone==='ok'?'#dff5e5':''}
function installRemotePersistence(){
 const oldPersist=window.persist;window.persist=function(){oldPersist();cogsPushRemote()};
 const oldSave=window.save;window.save=function(){localStorage.setItem('woods-cogs-v4',JSON.stringify(data));render();cogsPushRemote()};
 const oldRecipeChange=window.recipeChange;window.recipeChange=function(...args){oldRecipeChange(...args);cogsPushRemote()};
 const oldRecipeRemove=window.recipeRemove;window.recipeRemove=function(...args){oldRecipeRemove(...args);cogsPushRemote()};
 const oldRecipeAdd=window.recipeAdd;window.recipeAdd=function(...args){oldRecipeAdd(...args);cogsPushRemote()};
}
function cogsDeny(message){
 const root=document.getElementById('cogsRoot');
 if(root)root.innerHTML='<div class="cards"><article><h2>Admin access only</h2><p>'+message+'</p><p><button class="primary" onclick="location.href=\'v16.html\'">Back to Woods Team Hub</button></p></article></div>';
 cogsBanner('Restricted workspace','error');
}
async function cogsStart(){
 if(!cogsDb){cogsBanner('Supabase library/config missing','error');return}
 const {data:{session}}=await cogsDb.auth.getSession();cogsUser=session?.user||null;
 if(!cogsUser){cogsDeny('Sign in to Woods Team Hub with an administrator account first.');return}
 const {data:profile,error:profileError}=await cogsDb.from('profiles').select('role').eq('id',cogsUser.id).maybeSingle();
 if(profileError){cogsDeny('Your access level could not be verified. Return to the Team Hub and try again.');return}
 if(profile?.role!=='admin'){cogsUser=null;cogsDeny('Cost of Goods is restricted to Woods administrators.');return}
 cogsBanner('Connecting to shared COGS data…');
 try{await cogsLoadRemote();installRemotePersistence();render();cogsBanner('Shared Supabase data connected · Admin','ok')}catch(e){console.error(e);cogsBanner('Supabase connection failed: '+(e.message||e),'error')}
}
window.addEventListener('DOMContentLoaded',cogsStart);
