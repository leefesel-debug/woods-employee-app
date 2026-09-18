let coshhItems=[],editingCoshh=null;
const COSHH_FIELDS=['product_name','supplier','purpose','hazard_classification','symbols','risk_assessment','safe_usage_instructions','first_aid_measures','ppe_required','storage_instructions','spill_exposure_procedure','sds_location','review_date','next_review_date'];

function coshhText(value){return safe(value).replace(/\r?\n/g,'<br>')}
function coshhSdsMissing(item){return !item.sds_location||/await|not recorded|obtain current/i.test(item.sds_location)}
function coshhLevel(item){
 const text=[item.hazard_classification,item.symbols,item.risk_assessment].join(' ');
 if(/non-hazard|not classified as hazardous/i.test(item.hazard_classification))return 'low';
 if(/corros|skin corr|H314|H318|severe.*burn|serious eye damage/i.test(text))return 'high';
 if(/irrit|H315|H319|warning|exclamation/i.test(text))return 'irritant';
 return 'low';
}
function coshhLevelLabel(level){return level==='high'?'Higher hazard':level==='irritant'?'Irritant':'Low / not classified'}
function updateCoshhHomeCount(){
 const el=$('#homeCoshhCount');if(!el)return;
 el.textContent=currentUser?(coshhItems.length+' product'+(coshhItems.length===1?'':'s')):'Sign in to view';
}
async function loadCoshh(){
 const setup=$('#coshhSetupMessage');
 if(!currentUser){coshhItems=[];setup.innerHTML='<div class="handbook-empty"><strong>Sign in to view the COSHH register.</strong></div>';renderCoshh();updateCoshhHomeCount();return}
 const {data,error}=await db.from('coshh_products').select('*').eq('active',true).order('product_name');
 if(error){coshhItems=[];setup.innerHTML='<div class="handbook-empty"><strong>COSHH setup is not complete yet.</strong><br>Run <code>supabase-coshh.sql</code> in the <a href="https://supabase.com/dashboard/project/ypquqxolphrocdohcrrg/sql/new" target="_blank" rel="noopener">Supabase SQL Editor</a>.</div>';renderCoshh();updateCoshhHomeCount();return}
 setup.innerHTML='';coshhItems=data||[];renderCoshh();updateCoshhHomeCount();
}
function renderCoshh(){
 const q=$('#coshhSearch').value.trim().toLowerCase(),filter=$('#coshhFilter').value;
 const shown=coshhItems.filter(x=>{
  const level=coshhLevel(x),missing=coshhSdsMissing(x);
  const filterMatch=!filter||(filter==='missing'?missing:level===filter);
  return filterMatch&&(!q||COSHH_FIELDS.map(k=>x[k]||'').join(' ').toLowerCase().includes(q));
 });
 const missingCount=coshhItems.filter(coshhSdsMissing).length;
 $('#coshhCount').textContent=shown.length+' product'+(shown.length===1?'':'s');
 $('#coshhSdsCount').textContent=missingCount+' SDS action'+(missingCount===1?'':'s');
 if(!currentUser){$('#coshhList').innerHTML='';return}
 if(!shown.length){$('#coshhList').innerHTML='<div class="handbook-empty">'+(coshhItems.length?'No products match that search.':isAdmin?'No COSHH products yet. Load the Woods register above.':'No active COSHH products are available.')+'</div>';return}
 $('#coshhList').innerHTML=shown.map(x=>{
  const level=coshhLevel(x),missing=coshhSdsMissing(x);
  return `<details class="coshh-card"><summary><div><span class="coshh-name">${safe(x.product_name)}</span><span class="coshh-supplier">${safe(x.supplier)}</span></div><div class="coshh-summary-badges"><span class="hazard-pill ${level}">${safe(coshhLevelLabel(level))}</span>${missing?'<span class="hazard-pill missing">SDS action</span>':''}</div></summary><div class="coshh-body"><div class="coshh-purpose">${coshhText(x.purpose)}</div><div class="coshh-fields"><div class="coshh-field"><small>Hazard classification</small><p>${coshhText(x.hazard_classification)||'Not recorded'}</p></div><div class="coshh-field"><small>Pictogram / symbol</small><p>${coshhText(x.symbols)||'Not recorded'}</p></div><div class="coshh-field wide"><small>Risk assessment</small><p>${coshhText(x.risk_assessment)||'Not recorded'}</p></div><div class="coshh-field wide safe-use"><small>Safe use</small><p>${coshhText(x.safe_usage_instructions)||'Not recorded'}</p></div><div class="coshh-field wide first-aid"><small>First aid</small><p>${coshhText(x.first_aid_measures)||'Check the current product label and SDS.'}</p></div><div class="coshh-field"><small>PPE</small><p>${coshhText(x.ppe_required)||'Not recorded'}</p></div><div class="coshh-field"><small>Storage</small><p>${coshhText(x.storage_instructions)||'Not recorded'}</p></div><div class="coshh-field wide spill"><small>Spill / exposure response</small><p>${coshhText(x.spill_exposure_procedure)||'Check the current product label and SDS.'}</p></div><div class="coshh-field wide ${missing?'sds-missing':''}"><small>SDS location</small><p>${coshhText(x.sds_location)||'Not recorded'}</p></div>${x.review_date||x.next_review_date?`<div class="coshh-field wide"><small>Review</small><p>${x.review_date?'Last reviewed '+safe(coshhDate(x.review_date)):''}${x.review_date&&x.next_review_date?' · ':''}${x.next_review_date?'Next review '+safe(coshhDate(x.next_review_date)):''}</p></div>`:''}</div><div class="coshh-admin-actions"><button class="mini" onclick="editCoshhItem('${x.id}')">Edit</button><button class="mini danger" onclick="archiveCoshhItem('${x.id}')">Archive</button></div></div></details>`;
 }).join('');
}
function coshhDate(value){return value?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00')):''}
function parseCoshhRows(rows){
 const cleaned=rows.map(r=>r.map(v=>String(v||'').replace(/^\uFEFF/,'').replace(/\u0000/g,'').trim()));
 const hi=cleaned.findIndex(r=>r.some(v=>/^product name$/i.test(v)));if(hi<0)throw new Error('Could not find the Product Name heading in the COSHH CSV.');
 const headers=cleaned[hi].map(x=>x.toLowerCase().replace(/\s+/g,' ').trim());
 const column=name=>headers.indexOf(name);
 const columns={product_name:column('product name'),supplier:column('supplier / manufacture'),purpose:column('purpose'),hazard_classification:column('hazard classification'),symbols:column('symbols'),risk_assessment:column('risk assessment'),safe_usage_instructions:column('safe usage instructions'),first_aid_measures:column('first aid measures'),ppe_required:column('ppe required'),storage_instructions:column('storage instructions'),spill_exposure_procedure:column('spill / exposure procedure'),sds_location:column('sds location')};
 if(columns.product_name<0)throw new Error('The COSHH CSV must contain a Product Name column.');
 const tidy=value=>String(value||'').replace(/\nCater Point UK Ltd/g,'').replace(/ ?\ncentreglassonline\.co\.uk/g,'').trim();
 const records=cleaned.slice(hi+1).map(row=>{
  const item=Object.fromEntries(Object.entries(columns).map(([key,index])=>[key,index>=0?tidy(row[index]):'']));
  if(!item.product_name)return null;
  if(item.risk_assessment==='#NAME?')item.risk_assessment='Risk assessment missing from the source register. Confirm against the current supplier SDS before use.';
  if(!item.sds_location)item.sds_location='Not recorded – obtain current supplier SDS';
  return item;
 }).filter(Boolean);
 if(!records.length)throw new Error('No COSHH products were found in the CSV.');
 return records;
}
async function importCoshh(){
 if(!isAdmin)return;
 const button=$('#importCoshh');button.disabled=true;button.textContent='Loading…';
 try{
  const file=$('#coshhCsvFile').files[0];if(!file)throw new Error('Choose the Woods COSHH CSV file first.');
  const source=parseCoshhRows(parseCSV(await readCSVFile(file)));
  if(!confirm('Load '+source.length+' products from the attached Woods COSHH register? This will archive and replace the current active register.'))return;
  if(coshhItems.length){const {error}=await db.from('coshh_products').update({active:false,updated_by:currentUser.id}).eq('active',true);if(error)throw error}
  const rows=source.map(x=>({...x,active:true,created_by:currentUser.id,updated_by:currentUser.id}));
  const {error}=await db.from('coshh_products').insert(rows);if(error)throw error;
  $('#coshhCsvFile').value='';await loadCoshh();showMessage(rows.length+' COSHH products loaded into the shared register.');
 }catch(e){showMessage(e.message)}
 finally{button.disabled=false;button.textContent='Import COSHH CSV'}
}
function openCoshhEditor(item=null){
 if(!isAdmin)return;editingCoshh=item?.id||null;$('#coshhDialogTitle').textContent=item?'Edit COSHH product':'Add COSHH product';
 const mapping={product_name:'chProduct',supplier:'chSupplier',purpose:'chPurpose',hazard_classification:'chHazard',symbols:'chSymbols',risk_assessment:'chRisk',safe_usage_instructions:'chSafeUse',first_aid_measures:'chFirstAid',ppe_required:'chPpe',storage_instructions:'chStorage',spill_exposure_procedure:'chSpill',sds_location:'chSds',review_date:'chReviewed',next_review_date:'chReviewDue'};
 for(const [key,id] of Object.entries(mapping))$('#'+id).value=item?.[key]||'';
 $('#coshhEditor').showModal();
}
window.editCoshhItem=id=>openCoshhEditor(coshhItems.find(x=>x.id===id));
async function saveCoshh(e){
 e.preventDefault();if(!isAdmin)return;
 const value={product_name:$('#chProduct').value.trim(),supplier:$('#chSupplier').value.trim(),purpose:$('#chPurpose').value.trim(),hazard_classification:$('#chHazard').value.trim(),symbols:$('#chSymbols').value.trim(),risk_assessment:$('#chRisk').value.trim(),safe_usage_instructions:$('#chSafeUse').value.trim(),first_aid_measures:$('#chFirstAid').value.trim(),ppe_required:$('#chPpe').value.trim(),storage_instructions:$('#chStorage').value.trim(),spill_exposure_procedure:$('#chSpill').value.trim(),sds_location:$('#chSds').value.trim(),review_date:$('#chReviewed').value||null,next_review_date:$('#chReviewDue').value||null,updated_by:currentUser.id};
 const button=$('#saveCoshh');button.disabled=true;button.textContent='Saving…';
 try{
  const result=editingCoshh?await db.from('coshh_products').update(value).eq('id',editingCoshh):await db.from('coshh_products').insert({...value,active:true,created_by:currentUser.id});
  if(result.error)throw result.error;$('#coshhEditor').close();await loadCoshh();
 }catch(err){showMessage(err.message)}
 finally{button.disabled=false;button.textContent='Save product'}
}
window.archiveCoshhItem=async id=>{
 if(!isAdmin)return;const item=coshhItems.find(x=>x.id===id);if(!item||!confirm('Archive '+item.product_name+'?'))return;
 const {error}=await db.from('coshh_products').update({active:false,updated_by:currentUser.id}).eq('id',id);if(error)return showMessage(error.message);await loadCoshh();
};

$('#coshhSearch').oninput=renderCoshh;
$('#coshhFilter').onchange=renderCoshh;
$('#importCoshh').onclick=importCoshh;
$('#addCoshh').onclick=()=>openCoshhEditor();
$('#coshhForm').onsubmit=saveCoshh;
if(currentUser)loadCoshh();else updateCoshhHomeCount();
