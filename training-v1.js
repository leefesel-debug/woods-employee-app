let trainingRecords=[],editingTraining=null,refreshingTraining=null;
const TRAINING_FIELDS=['person_name','role','training_name','additional_details','signed_dated'];

function trainingDate(value){return value?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00')):''}
function trainingToday(){return localISODate()}
function trainingAddDays(value,days){const d=new Date(value+'T12:00:00');d.setDate(d.getDate()+days);return localISODate(d)}
function trainingAddMonths(value,months){
 if(!value||!months)return '';
 const [year,month,day]=value.split('-').map(Number),targetMonth=month-1+Number(months),lastDay=new Date(year, targetMonth+1,0).getDate();
 return localISODate(new Date(year,targetMonth,Math.min(day,lastDay),12));
}
function trainingType(item){return item.completion_status||'completed'}
function trainingStatus(item){
 if(trainingType(item)==='required')return item.due_date&&item.due_date<trainingToday()?'overdue':'required';
 if(!item.expiry_date)return 'none';
 if(item.expiry_date<trainingToday())return 'expired';
 if(item.expiry_date<=trainingAddDays(trainingToday(),60))return 'due';
 return 'current';
}
function trainingStatusLabel(status){return status==='overdue'?'Requirement overdue':status==='required'?'Required':status==='expired'?'Expired':status==='due'?'Due soon':status==='current'?'Current':'No expiry'}
function trainingNeedsAction(item){return ['required','overdue','expired','due'].includes(trainingStatus(item))}
function updateTrainingHomeCount(){
 const el=$('#homeTrainingCount');if(!el)return;
 if(!currentUser){el.textContent='Sign in to view';return}
 const action=trainingRecords.filter(trainingNeedsAction).length;
 el.textContent=action?action+' action'+(action===1?'':'s')+' due':trainingRecords.length+' records';
}
async function loadTraining(){
 const setup=$('#trainingSetupMessage');
 if(!currentUser){trainingRecords=[];setup.innerHTML='<div class="handbook-empty"><strong>Sign in to view the training log.</strong></div>';renderTraining();updateTrainingHomeCount();return}
 const {data,error}=await db.from('training_records').select('*').eq('active',true).order('person_name').order('training_date',{ascending:false});
 if(error){trainingRecords=[];setup.innerHTML='<div class="handbook-empty"><strong>Training Log setup is not complete yet.</strong><br>Run <code>supabase-training.sql</code> in the <a href="https://supabase.com/dashboard/project/ypquqxolphrocdohcrrg/sql/new" target="_blank" rel="noopener">Supabase SQL Editor</a>.</div>';renderTraining();updateTrainingHomeCount();return}
 setup.innerHTML='';trainingRecords=data||[];renderTraining();updateTrainingHomeCount();
}
function refreshTrainingFilters(){
 const staff=$('#trainingStaff'),current=staff.value;
 const names=[...new Set(trainingRecords.map(x=>x.person_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 staff.innerHTML='<option value="">All staff</option>'+names.map(x=>`<option value="${safe(x)}">${safe(x)}</option>`).join('');staff.value=names.includes(current)?current:'';
 const optionSets=[['#trainingPersonOptions','person_name'],['#trainingRoleOptions','role'],['#trainingCourseOptions','training_name']];
 for(const [selector,key] of optionSets){const values=[...new Set(trainingRecords.map(x=>x[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));$(selector).innerHTML=values.map(x=>`<option value="${safe(x)}">`).join('')}
}
function trainingRecordRow(item){
 const status=trainingStatus(item),detail=[item.additional_details,item.signed_dated?`Signed / dated: ${item.signed_dated}`:''].filter(Boolean).join(' · ');
 const required=trainingType(item)==='required';
 const meta=required?`Assigned ${safe(trainingDate(item.assigned_date||item.created_at?.slice(0,10)))}${item.due_date?' · complete by '+safe(trainingDate(item.due_date)):''}`:`Completed ${safe(trainingDate(item.training_date))}${item.expiry_date?' · next due '+safe(trainingDate(item.expiry_date)):' · no expiry'}`;
 const actionLabel=required?'Record completion':'Record refresher';
 return `<article class="training-record"><div class="training-record-main"><div class="training-course">${safe(item.training_name)}</div><div class="training-meta">${meta}</div>${detail?`<div class="training-detail">${safe(detail)}</div>`:''}</div><span class="training-status ${status}">${trainingStatusLabel(status)}</span><div class="training-admin-actions"><button class="mini primary" onclick="refreshTrainingRecord('${item.id}')">${actionLabel}</button>${required?'':`<button class="mini" onclick="editTrainingRecord('${item.id}')">Edit</button>`}<button class="mini danger" onclick="archiveTrainingRecord('${item.id}')">Archive</button></div></article>`;
}
function renderTraining(){
 refreshTrainingFilters();
 const q=$('#trainingSearch').value.trim().toLowerCase(),staff=$('#trainingStaff').value,status=$('#trainingStatus').value;
 const shown=trainingRecords.filter(x=>(!staff||x.person_name===staff)&&(!status||trainingStatus(x)===status)&&(!q||[...TRAINING_FIELDS.map(k=>x[k]||''),x.training_date,x.expiry_date].join(' ').toLowerCase().includes(q)));
 const expired=trainingRecords.filter(x=>['expired','overdue'].includes(trainingStatus(x))).length,due=trainingRecords.filter(x=>['due','required'].includes(trainingStatus(x))).length;
 const staffCount=new Set(trainingRecords.filter(x=>x.person_name&&x.person_name.toLowerCase()!=='all').map(x=>x.person_name)).size;
 $('#trainingRecordCount').textContent=shown.length+' record'+(shown.length===1?'':'s');$('#trainingStaffCount').textContent=staffCount+' staff';$('#trainingActionCount').textContent=(expired+due)+' action'+(expired+due===1?'':'s')+' due';$('#trainingActionCount').dataset.tone=expired?'error':due?'warning':'ok';
 if(!currentUser){$('#trainingList').innerHTML='';return}
 if(!shown.length){$('#trainingList').innerHTML='<div class="handbook-empty">'+(trainingRecords.length?'No training records match those filters.':isAdmin?'No training records yet. Import the Woods CSV above.':'No active training records are available.')+'</div>';return}
 const grouped=new Map();for(const item of shown){if(!grouped.has(item.person_name))grouped.set(item.person_name,[]);grouped.get(item.person_name).push(item)}
 const open=Boolean(q||staff||status);
 $('#trainingList').innerHTML=[...grouped.entries()].map(([name,records])=>{
  const roles=[...new Set(records.map(x=>x.role).filter(Boolean))].join(' / '),actions=records.filter(trainingNeedsAction).length;
  return `<details class="training-person" ${open?'open':''}><summary><div><span class="training-person-name">${safe(name)}</span><span class="training-role">${safe(roles||'Role not recorded')}</span></div><div class="training-person-summary"><span>${records.length} record${records.length===1?'':'s'}</span>${actions?`<span class="training-status ${records.some(x=>['expired','overdue'].includes(trainingStatus(x)))?'expired':'due'}">${actions} action${actions===1?'':'s'}</span>`:''}</div></summary><div class="training-person-body">${records.map(trainingRecordRow).join('')}</div></details>`;
 }).join('');
}
function parseTrainingDate(value,rowNumber,required=false){
 const raw=String(value||'').trim();if(!raw||/^(n\/?a|none|not applicable)$/i.test(raw)){if(required)throw new Error('Training date missing on CSV row '+rowNumber+'.');return null}
 if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
 const match=raw.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{2,4})$/i);if(!match)throw new Error('Could not read the date "'+raw+'" on CSV row '+rowNumber+'.');
 const months={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
 const month=months[match[2].toLowerCase()];let year=Number(match[3]);if(match[3].length===2)year+=2000;if(match[3].length===3&&year>=200&&year<=299)year+=1820;
 const day=Number(match[1]);if(!month||year<2000||year>2100||day<1||day>31)throw new Error('Could not read the date "'+raw+'" on CSV row '+rowNumber+'.');
 const iso=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,test=new Date(iso+'T12:00:00');if(Number.isNaN(test.valueOf())||test.getDate()!==day)throw new Error('Invalid date "'+raw+'" on CSV row '+rowNumber+'.');return iso;
}
function tidyTrainingName(value){return String(value||'').trim().replace(/^Dailly\b/i,'Daily').replace(/DIshwasher/g,'Dishwasher').replace(/\s+/g,' ')}
function parseTrainingRows(rows){
 const cleaned=rows.map(r=>r.map(v=>String(v||'').replace(/^\uFEFF/,'').replace(/\u0000/g,'').trim()));
 const hi=cleaned.findIndex(r=>r.some(v=>/^training received$/i.test(v))&&r.some(v=>/^name$/i.test(v)));if(hi<0)throw new Error('Could not find the training-log headings in the CSV.');
 const headers=cleaned[hi].map(x=>x.toLowerCase().replace(/\s+/g,' ').trim()),column=re=>headers.findIndex(x=>re.test(x));
 const columns={training_date:column(/^date$/),expiry_date:column(/^expires?$/),person_name:column(/^name$/),role:column(/^role$/),training_name:column(/^training received$/),additional_details:column(/^additional details$/),signed_dated:column(/^signed \/ dated$/)};
 for(const required of ['training_date','person_name','role','training_name'])if(columns[required]<0)throw new Error('The CSV is missing the '+required.replace('_',' ')+' column.');
 const records=cleaned.slice(hi+1).map((row,i)=>{const rowNumber=hi+i+2,name=String(row[columns.person_name]||'').trim(),training=tidyTrainingName(row[columns.training_name]);if(!name&&!training)return null;if(!name||!training)throw new Error('Name or training is missing on CSV row '+rowNumber+'.');return{training_date:parseTrainingDate(row[columns.training_date],rowNumber,true),expiry_date:columns.expiry_date>=0?parseTrainingDate(row[columns.expiry_date],rowNumber):null,person_name:name,role:String(row[columns.role]||'').trim(),training_name:training,additional_details:columns.additional_details>=0?String(row[columns.additional_details]||'').trim():'',signed_dated:columns.signed_dated>=0?String(row[columns.signed_dated]||'').trim():''}}).filter(Boolean);
 if(!records.length)throw new Error('No training records were found in the CSV.');return records;
}
async function importTraining(){
 if(!isAdmin)return;const button=$('#importTraining');button.disabled=true;button.textContent='Loading…';
 try{
  const file=$('#trainingCsvFile').files[0];if(!file)throw new Error('Choose the Woods Training Log CSV file first.');
  const source=parseTrainingRows(parseCSV(await readCSVFile(file)));
  const people=new Set(source.filter(x=>x.person_name.toLowerCase()!=='all').map(x=>x.person_name)).size;
  if(!confirm('Load '+source.length+' training records for '+people+' staff? This will archive and replace the current active training log.'))return;
  if(trainingRecords.length){const {error}=await db.from('training_records').update({active:false,updated_by:currentUser.id}).eq('active',true);if(error)throw error}
  const rows=source.map(x=>({...x,completion_status:'completed',assigned_date:x.training_date,due_date:null,active:true,created_by:currentUser.id,updated_by:currentUser.id}));for(let i=0;i<rows.length;i+=100){const {error}=await db.from('training_records').insert(rows.slice(i,i+100));if(error)throw error}
  $('#trainingCsvFile').value='';await loadTraining();showMessage(rows.length+' training records loaded into the shared log.');
 }catch(e){showMessage(e.message)}finally{button.disabled=false;button.textContent='Import training CSV'}
}
function setTrainingRenewal(selectId,dateId,expiryId){
 const renewal=$('#'+selectId).value,date=$('#'+dateId).value,expiry=$('#'+expiryId);
 if(renewal==='custom'){expiry.disabled=false;return}
 expiry.disabled=false;expiry.value=renewal?trainingAddMonths(date,Number(renewal)):'';
}
function inferTrainingRenewal(date,expiry){
 if(!date||!expiry)return '';
 for(const months of [12,24,36])if(trainingAddMonths(date,months)===expiry)return String(months);
 return 'custom';
}
function openTrainingEditor(item=null,refresh=false){
 if(!isAdmin)return;
 const required=item&&trainingType(item)==='required';editingTraining=refresh&&required?item.id:(!refresh&&item?.id)||null;refreshingTraining=refresh&&!required?item?.id:null;
 $('#trainingDialogTitle').textContent=refresh?(required?'Record training completion':'Record training refresher'):(item?'Edit training completion':'Add training completion');
 $('#trainingDialogHelp').textContent=refresh?'The previous entry will remain in the audit history. Choose the new completion date and next refresher interval.':'Record completed training and choose when it should next be refreshed.';
 const base=refresh?{...item,training_date:trainingToday(),expiry_date:trainingAddMonths(trainingToday(),12),signed_dated:''}:(item||{training_date:trainingToday(),expiry_date:trainingAddMonths(trainingToday(),12)});
 const fields={trPerson:'person_name',trRole:'role',trCourse:'training_name',trDate:'training_date',trExpiry:'expiry_date',trDetails:'additional_details',trSigned:'signed_dated'};for(const [id,key] of Object.entries(fields))$('#'+id).value=base?.[key]||'';
 $('#trRenewal').value=refresh||!item?'12':inferTrainingRenewal(base?.training_date,base?.expiry_date);$('#trPerson').disabled=Boolean(refresh);$('#trRole').disabled=Boolean(refresh);$('#trCourse').disabled=Boolean(refresh);$('#trainingEditor').showModal();
}
window.editTrainingRecord=id=>openTrainingEditor(trainingRecords.find(x=>x.id===id));
window.refreshTrainingRecord=id=>openTrainingEditor(trainingRecords.find(x=>x.id===id),true);
async function saveTraining(e){
 e.preventDefault();if(!isAdmin)return;const value={person_name:$('#trPerson').value.trim(),role:$('#trRole').value.trim(),training_name:$('#trCourse').value.trim(),completion_status:'completed',assigned_date:$('#trDate').value,due_date:null,training_date:$('#trDate').value,expiry_date:$('#trExpiry').value||null,additional_details:$('#trDetails').value.trim(),signed_dated:$('#trSigned').value.trim(),updated_by:currentUser.id};
 const button=$('#saveTraining');button.disabled=true;button.textContent='Saving…';try{
  let result;
  if(refreshingTraining){
   result=await db.from('training_records').insert({...value,active:true,created_by:currentUser.id});if(result.error)throw result.error;
   const archived=await db.from('training_records').update({active:false,updated_by:currentUser.id}).eq('id',refreshingTraining);if(archived.error)throw archived.error;
  }else result=editingTraining?await db.from('training_records').update(value).eq('id',editingTraining):await db.from('training_records').insert({...value,active:true,created_by:currentUser.id});
  if(result.error)throw result.error;$('#trainingEditor').close();await loadTraining();showMessage('Training completion saved.');
 }catch(err){showMessage(trainingFeatureError(err))}finally{button.disabled=false;button.textContent='Save completion'}
}
window.archiveTrainingRecord=async id=>{if(!isAdmin)return;const item=trainingRecords.find(x=>x.id===id);if(!item||!confirm('Archive '+item.training_name+' for '+item.person_name+'?'))return;const {error}=await db.from('training_records').update({active:false,updated_by:currentUser.id}).eq('id',id);if(error)return showMessage(error.message);await loadTraining()};

function trainingStaff(){
 const map=new Map();for(const item of trainingRecords){if(!item.person_name||item.person_name.toLowerCase()==='all')continue;if(!map.has(item.person_name))map.set(item.person_name,item.role||'')}
 return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
function renderBulkTrainingStaff(){
 const staff=trainingStaff();$('#trBulkStaff').innerHTML=staff.map(([name,role],i)=>`<label><input class="tr-bulk-person" type="checkbox" value="${safe(name)}" data-role="${safe(role)}" checked> <span>${safe(name)}${role?`<small class="category">${safe(role)}</small>`:''}</span></label>`).join('')||'<span class="category">No current staff were found in the training log.</span>';$('#trSelectAll').checked=staff.length>0;
}
function updateBulkTrainingForm(){
 const completed=$('#trBulkAction').value==='completed';$('#trBulkDateLabel').textContent=completed?'Completion date':'Assigned date';$('#trBulkDueLabel').textContent=completed?'Next due date':'Complete by';$('#trBulkRenewalField').hidden=!completed;
 if(completed)setTrainingRenewal('trBulkRenewal','trBulkDate','trBulkDue');else $('#trBulkDue').value=trainingAddDays($('#trBulkDate').value||trainingToday(),30);
}
function openBulkTraining(){
 if(!isAdmin)return;renderBulkTrainingStaff();$('#trBulkAction').value='required';$('#trBulkCourse').value='';$('#trBulkDate').value=trainingToday();$('#trBulkDue').value=trainingAddDays(trainingToday(),30);$('#trBulkRenewal').value='12';$('#trBulkDetails').value='';updateBulkTrainingForm();$('#bulkTrainingEditor').showModal();
}
function trainingFeatureError(error){
 const message=error?.message||String(error);return /completion_status|assigned_date|due_date/i.test(message)?'The Training Log upgrade needs to be completed first. Run the latest supabase-training.sql in the Supabase SQL Editor, then try again.':message;
}
async function saveBulkTraining(e){
 e.preventDefault();if(!isAdmin)return;const selected=[...document.querySelectorAll('.tr-bulk-person:checked')];if(!selected.length)return showMessage('Select at least one staff member.');
 const action=$('#trBulkAction').value,course=$('#trBulkCourse').value.trim(),date=$('#trBulkDate').value,due=$('#trBulkDue').value||null,details=$('#trBulkDetails').value.trim(),button=$('#saveBulkTraining');button.disabled=true;button.textContent='Updating…';
 try{
  for(const checkbox of selected){
   const person=checkbox.value,role=checkbox.dataset.role||'',same=trainingRecords.filter(x=>x.person_name===person&&x.training_name.toLowerCase()===course.toLowerCase());
   if(action==='required'){
    const pending=same.find(x=>trainingType(x)==='required');const value={person_name:person,role,training_name:course,completion_status:'required',assigned_date:date,due_date:due,training_date:null,expiry_date:null,additional_details:details,signed_dated:'',updated_by:currentUser.id};
    const result=pending?await db.from('training_records').update(value).eq('id',pending.id):await db.from('training_records').insert({...value,active:true,created_by:currentUser.id});if(result.error)throw result.error;
   }else{
    const pending=same.find(x=>trainingType(x)==='required'),previous=same.find(x=>trainingType(x)==='completed');const value={person_name:person,role,training_name:course,completion_status:'completed',assigned_date:date,due_date:null,training_date:date,expiry_date:due,additional_details:details,signed_dated:'',updated_by:currentUser.id};
    if(pending){const result=await db.from('training_records').update(value).eq('id',pending.id);if(result.error)throw result.error}
    else{const result=await db.from('training_records').insert({...value,active:true,created_by:currentUser.id});if(result.error)throw result.error;if(previous){const archived=await db.from('training_records').update({active:false,updated_by:currentUser.id}).eq('id',previous.id);if(archived.error)throw archived.error}}
   }
  }
  $('#bulkTrainingEditor').close();await loadTraining();showMessage((action==='required'?'Training requirement assigned to ':'Training completion recorded for ')+selected.length+' staff member'+(selected.length===1?'':'s')+'.');
 }catch(error){showMessage(trainingFeatureError(error))}finally{button.disabled=false;button.textContent='Apply to selected staff'}
}

$('#trainingSearch').oninput=renderTraining;$('#trainingStaff').onchange=renderTraining;$('#trainingStatus').onchange=renderTraining;$('#importTraining').onclick=importTraining;$('#addTraining').onclick=()=>openTrainingEditor();$('#bulkTraining').onclick=openBulkTraining;$('#trainingForm').onsubmit=saveTraining;$('#bulkTrainingForm').onsubmit=saveBulkTraining;
$('#trRenewal').onchange=()=>setTrainingRenewal('trRenewal','trDate','trExpiry');$('#trDate').onchange=()=>setTrainingRenewal('trRenewal','trDate','trExpiry');$('#trExpiry').onchange=()=>{$('#trRenewal').value=inferTrainingRenewal($('#trDate').value,$('#trExpiry').value)};
$('#trBulkAction').onchange=updateBulkTrainingForm;$('#trBulkRenewal').onchange=()=>setTrainingRenewal('trBulkRenewal','trBulkDate','trBulkDue');$('#trBulkDate').onchange=updateBulkTrainingForm;$('#trBulkDue').onchange=()=>{if($('#trBulkAction').value==='completed')$('#trBulkRenewal').value=inferTrainingRenewal($('#trBulkDate').value,$('#trBulkDue').value)};$('#trSelectAll').onchange=e=>document.querySelectorAll('.tr-bulk-person').forEach(x=>x.checked=e.target.checked);$('#trBulkStaff').onchange=()=>{$('#trSelectAll').checked=[...document.querySelectorAll('.tr-bulk-person')].every(x=>x.checked)};
if(currentUser)loadTraining();else updateTrainingHomeCount();
