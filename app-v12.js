const UK14=['Celery','Cereals containing gluten','Crustaceans','Eggs','Fish','Lupin','Milk','Molluscs','Mustard','Nuts','Peanuts','Sesame','Soya','Sulphites'];
const GLUTEN_CEREALS=['Wheat','Rye','Barley','Oats','Spelt','Khorasan'];
const STANDARD=[...UK14,...GLUTEN_CEREALS];
const $=s=>document.querySelector(s);
const cfg=window.WOODS_CONFIG||{};
const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
let items=[],editing=null,currentUser=null,isAdmin=false;

function safe(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function normalized(a){return [...new Set((a||[]).map(x=>String(x).trim()).filter(Boolean))]}
function setStatus(text,tone=''){const el=$('#syncState');el.textContent=text;el.dataset.tone=tone}
function showMessage(text){$('#messageText').textContent=text;$('#message').showModal()}
function canonical(s){
 const t=String(s||'').trim(),v=t.toLowerCase().replace(/[^a-z]/g,'');
 const exact={
  wheat:'Wheat',wehat:'Wheat',what:'Wheat',
  rye:'Rye',barley:'Barley',barely:'Barley',oats:'Oats',aots:'Oats',oat:'Oats',spelt:'Spelt',khorasan:'Khorasan',
  cereal:'Cereals containing gluten',cereals:'Cereals containing gluten',cerealscontaininggluten:'Cereals containing gluten',
  egg:'Eggs',eggs:'Eggs',dairy:'Milk',lactose:'Milk',milk:'Milk',butter:'Milk',cheese:'Milk',creamcheese:'Milk',whey:'Milk',
  soy:'Soya',soya:'Soya',treenut:'Nuts',treenuts:'Nuts',nut:'Nuts',nuts:'Nuts',almond:'Nuts',almonds:'Nuts',pistachio:'Nuts',pistachios:'Nuts',
  peanut:'Peanuts',peanuts:'Peanuts',groundnut:'Peanuts',sulphite:'Sulphites',sulphites:'Sulphites',sulfite:'Sulphites',sulfites:'Sulphites',
  sesame:'Sesame',mustard:'Mustard',celery:'Celery',fish:'Fish',crustacean:'Crustaceans',crustaceans:'Crustaceans',
  shellfish:'Crustaceans',mollusc:'Molluscs',molluscs:'Molluscs',lupin:'Lupin',maltextract:'Barley'
 };
 return exact[v]||STANDARD.find(x=>x.toLowerCase()===t.toLowerCase())||'';
}
function standardAllergens(values){return normalized((values||[]).map(canonical).filter(Boolean))}
function matchesAllergen(item,value){
 const list=standardAllergens(item.allergens);
 if(value==='Cereals containing gluten')return list.includes(value)||GLUTEN_CEREALS.some(x=>list.includes(x));
 return list.includes(value);
}
function iIsAllergen(h){return Boolean(canonical(h))}
function isMarked(v){return /^(x|yes|y|true|1|contains|✓|✔)$/i.test(String(v||'').trim())}
function dietaryFlags(item){
 const notes=String(item?.notes||'');
 return{vegan:/\bVegan:\s*Yes\b/i.test(notes),glutenFree:/\bGluten free:\s*Yes\b/i.test(notes)};
}
function cleanNotes(notes){
 return String(notes||'').split('·').map(x=>x.trim()).filter(x=>x&&!/^(Vegan|Gluten free):/i.test(x)).join(' · ');
}

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
 const categoryOptions=$('#categoryOptions');if(categoryOptions)categoryOptions.innerHTML=cats.map(x=>'<option value="'+safe(x)+'">').join('');
 const all=[...UK14.filter(x=>x!=='Cereals containing gluten'),'Cereals containing gluten',...GLUTEN_CEREALS];
 af.innerHTML='<option value="">All allergens</option>'+all.map(x=>'<option>'+safe(x)+'</option>').join('');
 af.value=all.includes(currentA)?currentA:'';
}

function render(){
 refreshFilters();
 const q=$('#search').value.trim().toLowerCase(),c=$('#category').value,a=$('#allergen').value,diet=$('#dietary').value;
 const shown=items.filter(x=>{
  const flags=dietaryFlags(x);
  const dietaryMatch=!diet||(diet==='vegan'&&flags.vegan)||(diet==='gf'&&flags.glutenFree)||(diet==='both'&&flags.vegan&&flags.glutenFree);
  const allergens=standardAllergens(x.allergens);
  return dietaryMatch&&(!c||x.category===c)&&(!a||matchesAllergen(x,a))&&(!q||[x.name,x.category,x.notes,...allergens].join(' ').toLowerCase().includes(q));
 });
 $('#count').textContent=shown.length+' product'+(shown.length===1?'':'s');
 if(!currentUser){$('#grid').innerHTML='<div class="empty"><strong>Sign in to view the allergen matrix.</strong><br><button class="btn primary inline" onclick="openAuth()">Sign in</button></div>';return}
 if(!shown.length){$('#grid').innerHTML='<div class="empty">'+(items.length?'No products match those filters.':isAdmin?'No data yet. Load the verified Woods data above.':'No active products are available.')+'</div>';return}
 $('#grid').innerHTML=shown.map(x=>{
  const flags=dietaryFlags(x),notes=cleanNotes(x.notes);
  return `<article class="card"><div class="card-head"><div><h2>${safe(x.name)}</h2><div class="category">${safe(x.category||'Uncategorised')}</div></div><button class="edit-card" onclick="editItem('${x.id}')">Edit</button></div><div class="dietary"><span class="diet vegan ${flags.vegan?'yes':'no'}">${flags.vegan?'✓ Vegan':'Not vegan'}</span><span class="diet gf ${flags.glutenFree?'yes':'no'}">${flags.glutenFree?'✓ Gluten free':'Not gluten free'}</span></div><div class="badges">${standardAllergens(x.allergens).length?standardAllergens(x.allergens).map(y=>`<span class="badge">${safe(y)}</span>`).join(''):'<span class="badge none">No listed allergens</span>'}</div>${notes?`<p class="notes">${safe(notes)}</p>`:''}<div class="actions"><button class="mini" onclick="editItem('${x.id}')">Edit</button><button class="mini danger" onclick="archiveItem('${x.id}')">Archive</button></div></article>`;
 }).join('');
}

async function readCSVFile(file){
 const buffer=await file.arrayBuffer();
 const bytes=new Uint8Array(buffer);
 let encoding='utf-8';
 if(bytes[0]===0xFF&&bytes[1]===0xFE)encoding='utf-16le';
 else if(bytes[0]===0xFE&&bytes[1]===0xFF)encoding='utf-16be';
 else{
  const sample=bytes.slice(0,Math.min(bytes.length,2000));
  let evenNulls=0,oddNulls=0;
  for(let i=0;i<sample.length;i++)if(sample[i]===0)(i%2?oddNulls++:evenNulls++);
  if(oddNulls>sample.length*.15)encoding='utf-16le';
  else if(evenNulls>sample.length*.15)encoding='utf-16be';
 }
 return new TextDecoder(encoding).decode(buffer).replace(/^\uFEFF/,'');
}

function parseCSV(text){
 function parseWith(delimiter){
  const rows=[];let row=[],cell='',quote=false;
  for(let i=0;i<text.length;i++){
   const ch=text[i],next=text[i+1];
   if(ch==='"'&&quote&&next==='"'){cell+='"';i++}
   else if(ch==='"'){quote=!quote}
   else if(ch===delimiter&&!quote){row.push(cell);cell=''}
   else if((ch==='\n'||ch==='\r')&&!quote){
    if(ch==='\r'&&next==='\n')i++;
    row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';
   }else cell+=ch;
  }
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
 }
 const candidates=[',',';','\t'].map(delimiter=>{
  const rows=parseWith(delimiter);
  const score=Math.max(0,...rows.slice(0,40).map(r=>r.reduce((n,v)=>{
   const h=String(v||'').replace(/^\uFEFF/,'').replace(/\u0000/g,'').trim().toLowerCase().replace(/\s+/g,' ');
   return n+(/^(item|product|product name|item name)$/.test(h)?10:/^(menu|category|supplier|vegan|gluten free|allergen|allergens)$/.test(h)?4:0);
  },0)));
  return{rows,score,width:Math.max(0,...rows.slice(0,40).map(r=>r.length))};
 }).sort((x,y)=>y.score-x.score||y.width-x.width);
 return candidates[0].rows;
}
function importRows(rows){
 if(rows.length<2)throw new Error('The CSV has no product rows.');
 const cleaned=rows.map(r=>r.map(v=>String(v||'').replace(/^\uFEFF/,'').replace(/\u0000/g,'').trim()));
 const scoreRow=r=>r.reduce((n,v)=>n+(/^(item|product|product name|item name)$/i.test(v)?5:/^(menu|category|supplier|vegan|gluten free|allergens?)$/i.test(v)?3:iIsAllergen(v)?2:0),0);
 let hi=0,best=-1;
 cleaned.slice(0,30).forEach((r,i)=>{const score=scoreRow(r);if(score>best){best=score;hi=i}});
 const headers=cleaned[hi], lower=headers.map(x=>x.toLowerCase().replace(/\s+/g,' ').trim());
 const findHeader=re=>lower.findIndex(x=>re.test(x));
 const categoryIndex=findHeader(/^(menu|category|section|group)$/);
 let nameIndex=findHeader(/^(item|product|product name|item name|dish|food|drink|name)$/);
 const supplierIndex=findHeader(/supplier|manufacturer|brand/);
 const veganIndex=findHeader(/^vegan/);
 const glutenFreeIndex=findHeader(/gluten[ -]?free/);
 let genericAllergenIndex=findHeader(/^allergen(s| information| info)?$/);
 if(genericAllergenIndex<0)genericAllergenIndex=findHeader(/allergen/);
 const allergenCols=headers.map((h,i)=>({h,i})).filter(o=>o.i!==genericAllergenIndex&&!/free|vegan/i.test(o.h)&&o.h&&iIsAllergen(o.h));
 if(nameIndex<0)nameIndex=headers.findIndex((h,i)=>h&&![categoryIndex,supplierIndex,veganIndex,glutenFreeIndex,genericAllergenIndex].includes(i)&&!allergenCols.some(a=>a.i===i));
 if(nameIndex<0)throw new Error('Could not identify the Item column. Detected headings: '+headers.filter(Boolean).join(', '));
 const nonProducts=/^(allergen|allergens|product|products|item|items|menu|category|section|key|yes|no)$/i;
 let lastCategory='';
 const records=cleaned.slice(hi+1).map(r=>{
   if(categoryIndex>=0&&(r[categoryIndex]||'').trim())lastCategory=(r[categoryIndex]||'').trim();
   const name=(r[nameIndex]||'').trim();
   if(!name||nonProducts.test(name))return null;
   let allergens=[];
   if(genericAllergenIndex>=0){
     const raw=(r[genericAllergenIndex]||'').trim();
     if(raw&&!/^(n\/?a|none|no|nil|not applicable|-+)$/i.test(raw)){
       allergens=raw.split(/[,;|&+]|\band\b|\r?\n/i)
         .map(x=>x.replace(/^(contains?|may contain|traces? of)\s*:?-?\s*/i,'').trim())
         .filter(Boolean).map(canonical);
     }
   }else if(allergenCols.length){
     allergens=allergenCols.filter(o=>isMarked(r[o.i])).map(o=>canonical(o.h));
   }
   const details=[];
   if(supplierIndex>=0&&(r[supplierIndex]||'').trim())details.push('Supplier: '+(r[supplierIndex]||'').trim());
   if(veganIndex>=0&&(r[veganIndex]||'').trim())details.push('Vegan: '+(r[veganIndex]||'').trim());
   if(glutenFreeIndex>=0&&(r[glutenFreeIndex]||'').trim())details.push('Gluten free: '+(r[glutenFreeIndex]||'').trim());
   return{name,category:lastCategory,allergens:normalized(allergens),notes:details.join(' · '),active:true,created_by:currentUser.id,updated_by:currentUser.id};
 }).filter(Boolean);
 if(!records.length)throw new Error('No product names were found. Please check the CSV has an Item column.');
 return records;
}

async function importCSV(){
 try{
  setStatus('Loading verified Woods data…');
  const response=await fetch('woods-products-v1.json?v=1',{cache:'no-store'});
  if(!response.ok)throw new Error('Could not load the verified Woods data.');
  const source=await response.json();
  const records=source.map(x=>({...x,active:true,created_by:currentUser.id,updated_by:currentUser.id}));
  const sample=records.slice(0,3).map(x=>x.name+(x.allergens.length?' — '+x.allergens.join(', '):' — no listed allergens')).join('\n');
  if(!confirm('Load '+records.length+' verified Woods products?\n\nFirst rows:\n'+sample+'\n\nThis will archive and replace the current list.')){setStatus('Shared data · up to date','ok');return}
  if(items.length){const {error:e1}=await db.from('products').update({active:false,updated_by:currentUser.id}).eq('active',true);if(e1)throw e1}
  for(let i=0;i<records.length;i+=100){const {error}=await db.from('products').insert(records.slice(i,i+100));if(error)throw error}
  await loadProducts();showMessage(records.length+' verified products loaded into the shared allergen matrix.');
 }catch(e){setStatus('Import failed','error');showMessage(e.message)}
}

function openEditor(item){
 if(!isAdmin)return;
 editing=item?.id||null;$('#dialogTitle').textContent=item?'Edit product':'Quick add product';
 const flags=dietaryFlags(item);
 $('#name').value=item?.name||'';$('#itemCategory').value=item?.category||'';$('#notes').value=cleanNotes(item?.notes);
 $('#vegan').checked=flags.vegan;$('#glutenFree').checked=flags.glutenFree;
 const selected=standardAllergens(item?.allergens);
 $('#checks').innerHTML='<div class="check-heading">UK 14 allergens</div>'+UK14.map(x=>`<label><input type="checkbox" value="${safe(x)}" ${selected.includes(x)?'checked':''}> ${safe(x)}</label>`).join('')+'<div class="check-heading">Specific gluten cereals</div>'+GLUTEN_CEREALS.map(x=>`<label><input type="checkbox" value="${safe(x)}" ${selected.includes(x)?'checked':''}> ${safe(x)}</label>`).join('');
 $('#editor').showModal();setTimeout(()=>$('#name').focus(),50);
}
async function saveItem(e){
 e.preventDefault();const name=$('#name').value.trim();if(!name)return;
 const custom=$('#notes').value.trim();
 const notes=`Vegan: ${$('#vegan').checked?'Yes':'No'} · Gluten free: ${$('#glutenFree').checked?'Yes':'No'}${custom?' · '+custom:''}`;
 const value={name,category:$('#itemCategory').value.trim(),notes,allergens:standardAllergens([...document.querySelectorAll('#checks input:checked')].map(x=>x.value)),updated_by:currentUser.id};
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
$('#search').oninput=render;$('#dietary').onchange=render;$('#category').onchange=render;$('#allergen').onchange=render;
$('#importBtn').onclick=importCSV;$('#addBtn').onclick=()=>openEditor();$('#editForm').onsubmit=saveItem;
$('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(items,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='woods-allergen-backup.json';a.click();URL.revokeObjectURL(a.href)};
initialise();
