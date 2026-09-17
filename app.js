const STANDARD=['Celery','Cereals containing gluten','Crustaceans','Eggs','Fish','Lupin','Milk','Molluscs','Mustard','Nuts','Peanuts','Sesame','Soya','Sulphites'];
const $=s=>document.querySelector(s);
const cfg=window.WOODS_CONFIG||{};
const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
let items=[],editing=null,currentUser=null,isAdmin=false;

function safe(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function normalized(a){return [...new Set((a||[]).map(x=>String(x).trim()).filter(Boolean))]}
function setStatus(text,tone=''){const el=$('#syncState');el.textContent=text;el.dataset.tone=tone}
function showMessage(text){$('#messageText').textContent=text;$('#message').showModal()}
function canonical(s){
 const t=String(s||'').trim(),v=t.toLowerCase();
 const aliases=[
  [/gluten|wheat|barley|rye|oat/,'Cereals containing gluten'],
  [/^egg(s)?$/,'Eggs'],[/dairy|lactose|^milk$/,'Milk'],
  [/soy|soya/,'Soya'],[/tree nut|^nut(s)?$/,'Nuts'],
  [/peanut|groundnut/,'Peanuts'],[/sulph|sulf/,'Sulphites'],
  [/sesame/,'Sesame'],[/mustard/,'Mustard'],[/celery/,'Celery'],
  [/fish/,'Fish'],[/crustacean|shellfish/,'Crustaceans'],
  [/mollusc/,'Molluscs'],[/lupin/,'Lupin']
 ];
 const hit=aliases.find(([re])=>re.test(v));
 return hit?hit[1]:(STANDARD.find(x=>x.toLowerCase()===v)||t);
}
function iIsAllergen(h){const t=h.toLowerCase();return STANDARD.some(x=>t.includes(x.toLowerCase())||x.toLowerCase().includes(t))}
function isMarked(v){return /^(x|yes|y|true|1|contains|✓|✔)$/i.test(String(v||'').trim())}

async function initialise(){
 const {data:{session}}=await db.auth.getSession();
 await applySession(session);
 db.auth.onAuthStateChange(async(_,session)=>applySession(session));
}

async function applySession(session){
 currentUser=session?.user||null;isAdmin=false;
 if(currentUser){
   const {data}=await db.from('profiles').select('role,display_name').eq('id',currentUser.id).maybeSingle();
   isAdmin=data?.role==='admin';
 }
 document.body.classList.toggle('signed-in',!!currentUser);
 document.body.classList.toggle('admin',isAdmin);
 $('#accountBtn').textContent=currentUser?(isAdmin?'Admin account':'Staff account'):'Sign in';
 $('#adminPanel').hidden=!isAdmin;
 await loadProducts();
}

async function loadProducts(){
 if(!currentUser){items=[];setStatus('Sign in required');render();return}
 setStatus('Syncing…');
 const {data,error}=await db.from('products').select('id,name,category,allergens,notes,active,updated_at').eq('active',true).order('category').order('name');
 if(error){setStatus('Sync failed','error');showMessage(error.message);return}
 items=data||[];setStatus('Shared data · up to date','ok');render();
}

function refreshFilters(){
 const cat=$('#category'),af=$('#allergen'),currentC=cat.value,currentA=af.value;
 const cats=[...new Set(items.map(x=>x.category).filter(Boolean))].sort();
 cat.innerHTML='<option value="">All categories</option>'+cats.map(x=>'<option>'+safe(x)+'</option>').join('');
 cat.value=cats.includes(currentC)?currentC:'';
 const all=[...new Set([...STANDARD,...items.flatMap(x=>x.allergens||[])])].sort();
 af.innerHTML='<option value="">All allergens</option>'+all.map(x=>'<option>'+safe(x)+'</option>').join('');
 af.value=all.includes(currentA)?currentA:'';
}

function render(){
 refreshFilters();
 const q=$('#search').value.trim().toLowerCase(),c=$('#category').value,a=$('#allergen').value;
 const shown=items.filter(x=>(!c||x.category===c)&&(!a||(x.allergens||[]).includes(a))&&(!q||[x.name,x.category,...(x.allergens||[])].join(' ').toLowerCase().includes(q)));
 $('#count').textContent=shown.length+' product'+(shown.length===1?'':'s');
 if(!currentUser){$('#grid').innerHTML='<div class="empty"><strong>Sign in to view the allergen matrix.</strong><br><button class="btn primary inline" onclick="openAuth()">Sign in</button></div>';return}
 if(!shown.length){$('#grid').innerHTML='<div class="empty">'+(items.length?'No products match those filters.':isAdmin?'No data yet. Import the Woods CSV above.':'No active products are available.')+'</div>';return}
 $('#grid').innerHTML=shown.map(x=>`<article class="card"><div class="card-head"><div><h2>${safe(x.name)}</h2><div class="category">${safe(x.category||'Uncategorised')}</div></div></div><div class="badges">${x.allergens?.length?x.allergens.map(y=>`<span class="badge">${safe(y)}</span>`).join(''):'<span class="badge none">No listed allergens</span>'}</div>${x.notes?`<p class="notes">${safe(x.notes)}</p>`:''}<div class="actions"><button class="mini" onclick="editItem('${x.id}')">Edit</button><button class="mini danger" onclick="archiveItem('${x.id}')">Archive</button></div></article>`).join('');
}

function parseCSV(text){
 const rows=[];let row=[],cell='',quote=false;
 for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'&&quote&&next==='"'){cell+='"';i++}else if(ch==='"'){quote=!quote}else if(ch===','&&!quote){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!quote){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell=''}else cell+=ch}
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
function importRows(rows){
 if(rows.length<2)throw new Error('The CSV has no product rows.');
 const cleaned=rows.map(r=>r.map(v=>String(v||'').replace(/^\uFEFF/,'').trim()));
 const scoreRow=r=>r.reduce((n,v)=>n+(iIsAllergen(v)?3:/product|item|dish|menu|food|drink|name|category|section/i.test(v)?2:0),0);
 let hi=0,best=-1;
 cleaned.slice(0,25).forEach((r,i)=>{const score=scoreRow(r);if(score>best){best=score;hi=i}});
 const headers=cleaned[hi],lower=headers.map(x=>x.toLowerCase());
 const genericAllergenIndex=lower.findIndex(x=>/^allergens?$/.test(x));
 const categoryIndex=lower.findIndex(x=>/^(menu|category|section|group)$/.test(x));
 let nameIndex=lower.findIndex(x=>/^(item|product|product name|item name|dish|food|drink|name)$/.test(x));
 if(nameIndex<0)nameIndex=lower.findIndex(x=>/item|product|dish|food|drink|name/.test(x));
 const allergenCols=headers.map((h,i)=>({h,i})).filter(o=>o.i!==genericAllergenIndex&&!/free|vegan/i.test(o.h)&&o.h&&iIsAllergen(o.h));
 if(nameIndex<0)nameIndex=headers.findIndex((h,i)=>h&&i!==categoryIndex&&i!==genericAllergenIndex&&!allergenCols.some(a=>a.i===i));
 if(nameIndex<0)nameIndex=0;
 const nonProducts=/^(allergen|allergens|product|products|item|items|menu|category|section|key|yes|no)$/i;
 const records=cleaned.slice(hi+1).map(r=>{
   const name=(r[nameIndex]||'').trim();
   if(!name||nonProducts.test(name))return null;
   let allergens=[];
   if(genericAllergenIndex>=0){
     const raw=(r[genericAllergenIndex]||'').trim();
     if(raw&&!/^(n\/?a|none|no|nil|-+)$/i.test(raw)){
       allergens=raw.split(/[,;|/&+]|\band\b|\r?\n/i).map(canonical).filter(x=>STANDARD.includes(x));
     }
   }else if(allergenCols.length){
     allergens=allergenCols.filter(o=>isMarked(r[o.i])).map(o=>canonical(o.h));
   }
   return{name,category:categoryIndex>=0?(r[categoryIndex]||'').trim():'',allergens:normalized(allergens),active:true,created_by:currentUser.id,updated_by:currentUser.id};
 }).filter(Boolean);
 if(!records.length)throw new Error('No product names were found. Please check the CSV has a product or item column.');
 return records;
}

async function importCSV(){
 const file=$('#csvFile').files[0];if(!file)return showMessage('Choose the CSV file first.');
 try{
  const records=importRows(parseCSV(await file.text()));
  if(items.length&&!confirm('Archive the current list and import '+records.length+' products?'))return;
  setStatus('Importing…');
  if(items.length){const {error:e1}=await db.from('products').update({active:false,updated_by:currentUser.id}).eq('active',true);if(e1)throw e1}
  const {error}=await db.from('products').insert(records);if(error)throw error;
  await loadProducts();showMessage(records.length+' products imported to the shared allergen matrix.');
 }catch(e){setStatus('Import failed','error');showMessage(e.message)}
}

function openEditor(item){
 if(!isAdmin)return;
 editing=item?.id||null;$('#dialogTitle').textContent=item?'Edit product':'Add product';
 $('#name').value=item?.name||'';$('#itemCategory').value=item?.category||'';$('#notes').value=item?.notes||'';
 $('#checks').innerHTML=STANDARD.map(x=>`<label><input type="checkbox" value="${safe(x)}" ${item?.allergens?.includes(x)?'checked':''}> ${safe(x)}</label>`).join('');
 $('#editor').showModal();
}
async function saveItem(e){
 e.preventDefault();const name=$('#name').value.trim();if(!name)return;
 const value={name,category:$('#itemCategory').value.trim(),notes:$('#notes').value.trim(),allergens:[...document.querySelectorAll('#checks input:checked')].map(x=>x.value),updated_by:currentUser.id};
 let result;
 if(editing)result=await db.from('products').update(value).eq('id',editing);
 else result=await db.from('products').insert({...value,created_by:currentUser.id});
 if(result.error)return showMessage(result.error.message);
 $('#editor').close();await loadProducts();
}
window.editItem=id=>openEditor(items.find(x=>x.id===id));
window.archiveItem=async id=>{const item=items.find(x=>x.id===id);if(!item||!confirm('Archive '+item.name+'?'))return;const {error}=await db.from('products').update({active:false,updated_by:currentUser.id}).eq('id',id);if(error)return showMessage(error.message);await loadProducts()};
window.openAuth=()=>$('#auth').showModal();

async function signIn(e){
 e.preventDefault();const email=$('#email').value.trim(),password=$('#password').value;
 $('#authError').textContent='';
 const {error}=await db.auth.signInWithPassword({email,password});
 if(error){$('#authError').textContent=error.message;return}
 $('#auth').close();
}
async function signOut(){await db.auth.signOut();$('#account').close()}

$('#accountBtn').onclick=()=>currentUser?$('#account').showModal():openAuth();
$('#signInForm').onsubmit=signIn;$('#signOutBtn').onclick=signOut;
$('#search').oninput=render;$('#category').onchange=render;$('#allergen').onchange=render;
$('#importBtn').onclick=importCSV;$('#addBtn').onclick=()=>openEditor();$('#editForm').onsubmit=saveItem;
$('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(items,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='woods-allergen-backup.json';a.click();URL.revokeObjectURL(a.href)};
initialise();
