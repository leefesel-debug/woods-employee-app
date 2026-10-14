(function(){
'use strict';
const UK14=['Celery','Cereals containing gluten','Crustaceans','Eggs','Fish','Lupin','Milk','Molluscs','Mustard','Nuts','Peanuts','Sesame','Soya','Sulphites'];
const CEREALS=['Wheat','Rye','Barley','Oats','Spelt','Khorasan'];
const ALL=[...UK14,...CEREALS];
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const cfg=window.WOODS_CONFIG||{};
const db=window.supabase&&cfg.supabaseUrl?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
let user=null,admin=false,products=[],drafts=[],activeDraft=null,ocrReady=false;
const RULES=[
 ['Celery',/\b(?:celery|celeriac)\b/i],
 ['Crustaceans',/\b(?:crustaceans?|prawns?|shrimps?|crabs?|lobsters?|crayfish)\b/i],
 ['Eggs',/\b(?:eggs?|egg\s*(?:white|yolk)|albumen|ovalbumin)\b/i],
 ['Fish',/\b(?:fish|anchov(?:y|ies)|salmon|tuna|cod|haddock)\b/i],
 ['Lupin',/\b(?:lupin|lupine)\b/i],
 ['Milk',/\b(?:milk|whey|casein|caseinate|lactose|butter(?:milk)?|cheese|cream)\b/i],
 ['Molluscs',/\b(?:molluscs?|mussels?|oysters?|scallops?|squids?|octopus|clams?)\b/i],
 ['Mustard',/\bmustard\b/i],
 ['Nuts',/\b(?:tree nuts?|nuts?|almonds?|hazelnuts?|walnuts?|cashews?|pecans?|pistachios?|macadamias?|brazil nuts?)\b/i],
 ['Peanuts',/\b(?:peanuts?|groundnuts?|arachis)\b/i],
 ['Sesame',/\b(?:sesame|tahini)\b/i],
 ['Soya',/\b(?:soya?|soybeans?|edamame|tofu)\b/i],
 ['Sulphites',/\b(?:sulphites?|sulfites?|sulphur dioxide|sulfur dioxide|e22[0-8])\b/i],
 ['Wheat',/\b(?:wheat|semolina|durum|bulgur|couscous)\b/i],
 ['Rye',/\brye\b/i],['Barley',/\b(?:barley|malt extract|barley malt)\b/i],
 ['Oats',/\boats?\b/i],['Spelt',/\bspelt\b/i],['Khorasan',/\b(?:khorasan|kamut)\b/i]
];
const sort=a=>[...new Set(a||[])].sort((x,y)=>ALL.indexOf(x)-ALL.indexOf(y));
const includes=(a,b)=>a.includes(b);
function detect(text){
 const raw=String(text||'').replace(/\s+/g,' ');
 const mayMatch=raw.match(/\b(?:may\s+also\s+contain|may\s+contain|may\s+include|traces?\s+of|made\s+in\s+(?:a\s+)?(?:factory|facility)\s+(?:that\s+)?(?:also\s+)?handles)\b/i);
 const ingredients=mayMatch?raw.slice(0,mayMatch.index):raw;
 const may=mayMatch?raw.slice(mayMatch.index+mayMatch[0].length):'';
 const find=part=>RULES.filter(([,re])=>re.test(part)).map(([name])=>name);
 let contains=find(ingredients),precaution=find(may);
 if(contains.some(x=>CEREALS.includes(x)))contains.push('Cereals containing gluten');
 if(precaution.some(x=>CEREALS.includes(x)))precaution.push('Cereals containing gluten');
 // A mention of peanuts is not evidence of other tree nuts.
 if(contains.includes('Peanuts')&&!/\b(?:tree nuts?|nuts?|almonds?|hazelnuts?|walnuts?|cashews?|pecans?|pistachios?|macadamias?|brazil nuts?)\b/i.test(ingredients))contains=contains.filter(x=>x!=='Nuts');
 if(precaution.includes('Peanuts')&&!/\b(?:tree nuts?|nuts?|almonds?|hazelnuts?|walnuts?|cashews?|pecans?|pistachios?|macadamias?|brazil nuts?)\b/i.test(may))precaution=precaution.filter(x=>x!=='Nuts');
 return {contains:sort(contains),may:sort(precaution),hasIngredients:/\bingredients?\b/i.test(raw),hasMay:!!mayMatch};
}
function checkGroup(id,values=[]){$(id).innerHTML=ALL.map(n=>'<label><input type="checkbox" value="'+esc(n)+'" '+(values.includes(n)?'checked':'')+'><span>'+esc(n)+'</span></label>').join('');$(id).querySelectorAll('input').forEach(x=>x.addEventListener('change',compare));}
function checked(id){return sort([...$(id).querySelectorAll('input:checked')].map(x=>x.value))}
function currentProduct(){return products.find(p=>p.id===$('productSelect').value)||null}
function compare(){
 const p=currentProduct(),box=$('comparison');if(!p){box.innerHTML='New product: the checked allergens will be proposed for a new matrix entry after admin approval.';return}
 const previous=sort(p.allergens),next=checked('checks'),added=next.filter(x=>!previous.includes(x)),removed=previous.filter(x=>!next.includes(x));
 box.innerHTML='<strong>Rescan comparison — '+esc(p.name)+'</strong><br>'+
 (added.length?'Newly detected: <strong>'+esc(added.join(', '))+'</strong><br>':'No newly selected allergens.<br>')+
 (removed.length?'<strong style="color:#a72721">Previously recorded, now absent: '+esc(removed.join(', '))+'</strong><br>':'No existing allergens removed.<br>')+
 '<span class="small">An absence in OCR is not evidence an allergen has been removed. Verify any removals with the packaging and supplier.</span>';
}
function showStatus(id,message,bad=false){$(id).textContent=message;$(id).style.color=bad?'#a72721':'#667369'}
async function loadProducts(){
 const q=await db.from('products').select('id,name,category,allergens,notes').eq('active',true).order('name');
 if(q.error){showStatus('authStatus','Cannot load products: '+q.error.message,true);return}
 products=q.data||[];
 const current=$('productSelect').value;
 $('productSelect').innerHTML='<option value="">+ New product</option>'+products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
 $('productSelect').value=products.some(p=>p.id===current)?current:'';
 compare();
}
async function loadQueue(){
 if(!user)return;
 const q=await db.from('allergen_scan_drafts').select('*').order('created_at',{ascending:false}).limit(60);
 if(q.error){$('queue').innerHTML='<div class="warning">Pilot setup needed: run <strong>supabase-allergen-scanner-pilot.sql</strong> in the Supabase SQL Editor. '+esc(q.error.message)+'</div>';return}
 drafts=q.data||[];
 $('queue').innerHTML=drafts.length?drafts.map(d=>{
 const existing=products.find(p=>p.id===d.product_id);
 return '<div class="draft"><strong>'+esc(d.product_name)+' · '+esc(d.status)+'</strong>'+
 '<span class="small muted">'+esc(new Date(d.created_at).toLocaleString('en-GB'))+' · '+(existing?'Rescan':'New product')+'</span><br>'+
 '<span class="small">Contains: '+esc((d.contains_allergens||[]).join(', ')||'None selected')+'</span><br>'+
 '<span class="small">May contain: '+esc((d.may_contain_allergens||[]).join(', ')||'None selected')+'</span><br>'+
 (d.status==='pending'&&admin?'<button data-review="'+esc(d.id)+'" class="primary">Review / approve</button>':'')+
 '</div>'}).join(''):'<p class="muted">No scan submissions yet.</p>';
 $('queue').querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>reviewDraft(b.dataset.review));
}
function reviewDraft(id){
 const d=drafts.find(x=>x.id===id);if(!d||!admin)return;
 activeDraft=d.id;
 $('productSelect').value=d.product_id||'';
 $('productName').value=d.product_name;
 $('category').value=d.category;
 $('rawText').value=d.raw_label_text;
 $('reviewNotes').value=d.review_notes||'';
 checkGroup('checks',d.contains_allergens||[]);
 checkGroup('mayChecks',d.may_contain_allergens||[]);
 $('confirm').checked=false;compare();
 $('submit').textContent='Approve pilot review (no live changes)';
 $('submit').scrollIntoView({behavior:'smooth',block:'center'});
 showStatus('submitStatus','Pilot admin review: verify packaging and any proposed changes. This does NOT change live products. Dietary status is not assessed.');
}
function clearScan(){
 activeDraft=null;$('productSelect').value='';$('productName').value='';$('category').value='';$('rawText').value='';$('reviewNotes').value='';$('photo').value='';$('confirm').checked=false;
 checkGroup('checks');checkGroup('mayChecks');$('submit').textContent='Submit for admin approval';compare();showStatus('scanStatus','Ready for another label. No photo has been uploaded.');showStatus('submitStatus','');
}
function applyProduct(){const p=currentProduct();if(p){$('productName').value=p.name;$('category').value=p.category||''}else{$('productName').value='';$('category').value=''}compare()}
async function readPhoto(){
 const file=$('photo').files?.[0];if(!file){showStatus('scanStatus','Choose or take a photo first.',true);return}
 $('scan').disabled=true;
 try{
  showStatus('scanStatus','Loading on-device text recognition…');
  if(!ocrReady){
   await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Could not load text recognition. Check internet connection.'));document.head.appendChild(s)});
   ocrReady=true;
  }
  const result=await window.Tesseract.recognize(file,'eng',{logger:m=>{if(m.status==='recognizing text')showStatus('scanStatus','Reading label… '+Math.round((m.progress||0)*100)+'%')}});
  $('rawText').value=result?.data?.text||'';
  analyse();
  showStatus('scanStatus','Text extracted on this device. Carefully correct it against the label before submitting.');
 }catch(e){showStatus('scanStatus','Could not read photo: '+(e.message||e)+'. You can type or paste the label text instead.',true)}
 finally{$('scan').disabled=false}
}
function analyse(){
 const text=$('rawText').value.trim();if(!text){showStatus('scanStatus','Add label text or take a photo first.',true);return}
 const result=detect(text);checkGroup('checks',result.contains);checkGroup('mayChecks',result.may);
 compare();$('confirm').checked=false;
 showStatus('scanStatus',result.hasIngredients?'Possible matches highlighted. Check EVERY result and the original label.':'Ingredients heading not recognised. This may be an incomplete scan — verify the full ingredients list before proceeding.',!result.hasIngredients);
}
async function submit(){
 if(!user){showStatus('submitStatus','Sign in to the Team Hub first.',true);return}
 const name=$('productName').value.trim(),text=$('rawText').value.trim(),p=currentProduct();
 if(!name||!text){showStatus('submitStatus','Product name and label text are required.',true);return}
 if(text.length<15){showStatus('submitStatus','The label text looks incomplete. Check and enter the full ingredients.',true);return}
 if(!$('confirm').checked){showStatus('submitStatus','Please check the original label and tick the confirmation.',true);return}
 const contains=checked('checks'),may=checked('mayChecks');
 if(!contains.length&&!confirm('No contains-allergens selected. This does NOT establish allergen-free status. Are you certain you have reviewed the complete label?'))return;
 $('submit').disabled=true;
 try{
  if(activeDraft&&admin){
   const d=drafts.find(x=>x.id===activeDraft);if(!d||d.status!=='pending')throw new Error('This submission is no longer pending.');
   if(!confirm('Approve this PILOT scan for '+name+'? No live matrix records will be changed.'))return;
   // Pilot is deliberately isolated from production product records.
   // Staging and live currently share Supabase: never update public.products here.
   const q=await db.from('allergen_scan_drafts').update({
     status:'approved',reviewed_by:user.id,reviewed_at:new Date().toISOString(),
     product_name:name,category:$('category').value.trim(),
     contains_allergens:contains,may_contain_allergens:may,
     raw_label_text:text.slice(0,15000),review_notes:$('reviewNotes').value.trim()
   }).eq('id',activeDraft).eq('status','pending');
   if(q.error)throw q.error;
   clearScan();await loadQueue();
   showStatus('submitStatus','Pilot review approved ✓ The live allergen matrix has NOT been changed.');
  }else{
   const row={product_id:p?.id||null,product_name:name,category:$('category').value.trim(),contains_allergens:contains,may_contain_allergens:may,raw_label_text:text.slice(0,15000),review_notes:$('reviewNotes').value.trim(),submitted_by:user.id};
   const q=await db.from('allergen_scan_drafts').insert(row);
   if(q.error)throw q.error;
   clearScan();await loadQueue();showStatus('submitStatus','Submitted for admin approval ✓ No changes have been made to the live matrix.');
  }
 }catch(e){showStatus('submitStatus','Could not complete: '+(e.message||e),true)}
 finally{$('submit').disabled=false}
}
async function init(){
 checkGroup('checks');checkGroup('mayChecks');
 $('productSelect').onchange=applyProduct;
 $('scan').onclick=readPhoto;$('analyse').onclick=analyse;$('reset').onclick=clearScan;
 $('submit').onclick=submit;$('refresh').onclick=loadQueue;
 if(!db){showStatus('authStatus','Supabase configuration missing.',true);return}
 const session=await db.auth.getSession();user=session.data.session?.user||null;
 if(!user){showStatus('authStatus','Please sign in to Woods Team Hub, then return to the scanner.',true);$('submit').disabled=true;return}
 const role=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();admin=role.data?.role==='admin';
 showStatus('authStatus','Signed in · '+(admin?'Admin (can approve scans)':'Staff (can submit scans)'));
 await loadProducts();await loadQueue();
}
init();
})();