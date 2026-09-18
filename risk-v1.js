let riskAssessments=[],riskItemSummary=[],riskItems=[],riskReviews=[],riskSelected=null,riskEditingItem=null,riskAcknowledged=false;

function riskDate(value){
 return value?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00')):'Not set';
}
function riskStatus(assessment){
 if(assessment.approval_status==='draft')return{label:'Draft',tone:'draft'};
 const today=new Date();today.setHours(0,0,0,0);
 const review=new Date(assessment.review_date+'T12:00:00');
 const days=Math.ceil((review-today)/86400000);
 if(days<0)return{label:'Overdue by '+Math.abs(days)+' days',tone:'overdue'};
 if(days<=30)return{label:'Review due in '+days+' days',tone:'due'};
 return{label:'Current',tone:'current'};
}
function riskActionLabel(value){return({open:'Open action',in_progress:'In progress',complete:'Complete',not_required:'No action'})[value]||value}
function updateRiskHomeCount(){
 const el=$('#homeRiskCount');if(!el)return;
 if(!currentUser){el.textContent='Sign in to view';return}
 const urgent=riskAssessments.filter(x=>['due','overdue'].includes(riskStatus(x).tone)).length;
 el.textContent=urgent?urgent+' review'+(urgent===1?'':'s')+' due':riskAssessments.length+' assessments';
}
async function loadRiskAssessments(){
 const setup=$('#riskSetupMessage');
 if(!currentUser){riskAssessments=[];riskItemSummary=[];setup.innerHTML='<div class="handbook-empty"><strong>Sign in to view risk assessments.</strong></div>';$('#riskCards').innerHTML='';updateRiskHomeCount();return}
 const [{data,error},{data:itemData}]=await Promise.all([
  db.from('risk_assessments').select('id,slug,title,assessment_type,scope,responsible_person,issue_date,review_date,approval_status,version,approved_at,active,updated_at').eq('active',true).order('title'),
  db.from('risk_items').select('assessment_id,action_status,active').eq('active',true)
 ]);
 if(error){
  riskAssessments=[];riskItemSummary=[];
  setup.innerHTML='<div class="handbook-empty"><strong>Risk Assessment setup is not complete yet.</strong><br>Run <code>supabase-risk-assessments.sql</code> in the <a href="https://supabase.com/dashboard/project/ypquqxolphrocdohcrrg/sql/new" target="_blank" rel="noopener">Supabase SQL Editor</a>.</div>';
  $('#riskCards').innerHTML='';updateRiskHomeCount();return;
 }
 setup.innerHTML='';riskAssessments=data||[];riskItemSummary=itemData||[];renderRiskOverview();updateRiskHomeCount();
 if(riskSelected){riskSelected=riskAssessments.find(x=>x.id===riskSelected.id)||null;if(riskSelected)await loadRiskDetail()}
}
function renderRiskOverview(){
 const urgent=riskAssessments.filter(x=>['due','overdue'].includes(riskStatus(x).tone));
 $('#riskSetupMessage').innerHTML=urgent.length?`<div class="risk-alert"><div><strong>${urgent.length} assessment${urgent.length===1?'':'s'} need attention.</strong><br>Review dates are approaching or have passed.</div><span class="status-pill due">Action required</span></div>`:'';
 if(!riskAssessments.length){$('#riskCards').innerHTML='<div class="handbook-empty">No active risk assessments are available.</div>';return}
 $('#riskCards').innerHTML=riskAssessments.map(a=>{
  const status=riskStatus(a),open=riskItemSummary.filter(x=>x.assessment_id===a.id&&['open','in_progress'].includes(x.action_status)).length;
  return `<article class="risk-card"><div><div class="risk-meta"><span class="status-pill ${status.tone}">${safe(status.label)}</span><span class="status-pill draft">Version ${Number(a.version)}</span></div><h3>${safe(a.title)}</h3><p>${safe(a.scope||'Woods Coffee Shop assessment')}</p></div><div><p><strong>Responsible:</strong> ${safe(a.responsible_person)}</p><p><strong>Review:</strong> ${safe(riskDate(a.review_date))}</p></div><div class="risk-actions"><span class="chip">${open} open action${open===1?'':'s'}</span></div><button class="btn primary" onclick="openRiskAssessment('${a.id}')">View assessment</button></article>`;
 }).join('');
}
window.openRiskAssessment=async id=>{
 riskSelected=riskAssessments.find(x=>x.id===id);if(!riskSelected)return;
 $('#riskOverview').hidden=true;$('#riskDetail').hidden=false;await loadRiskDetail();window.scrollTo({top:0,behavior:'smooth'});
};
async function loadRiskDetail(){
 if(!riskSelected||!currentUser)return;
 const [itemsResult,reviewsResult,ackResult]=await Promise.all([
  db.from('risk_items').select('*').eq('assessment_id',riskSelected.id).eq('active',true).order('sort_order').order('section_title'),
  db.from('risk_review_history').select('id,version,reviewed_at,review_note').eq('assessment_id',riskSelected.id).order('version',{ascending:false}),
  db.from('risk_acknowledgements').select('id').eq('assessment_id',riskSelected.id).eq('user_id',currentUser.id).eq('version',riskSelected.version).maybeSingle()
 ]);
 if(itemsResult.error)return showMessage(itemsResult.error.message);
 riskItems=itemsResult.data||[];riskReviews=reviewsResult.data||[];riskAcknowledged=!!ackResult.data;renderRiskDetail();
}
function renderRiskDetail(){
 const a=riskSelected,status=riskStatus(a);if(!a)return;
 $('#riskTitle').textContent=a.title;$('#riskSubtitle').textContent=a.scope||'';
 $('#riskMeta').innerHTML=`<span class="status-pill ${status.tone}">${safe(status.label)}</span><span class="status-pill draft">Version ${Number(a.version)}</span><span class="chip">Responsible: ${safe(a.responsible_person)}</span><span class="chip">Issued: ${safe(riskDate(a.issue_date))}</span><span class="chip">Review: ${safe(riskDate(a.review_date))}</span>`;
 $('#riskAcknowledge').textContent=riskAcknowledged?'✓ Acknowledged':'Acknowledge';$('#riskAcknowledge').disabled=riskAcknowledged;
 renderRiskItems();
 $('#riskHistory').innerHTML=riskReviews.length?riskReviews.map(x=>`<div class="risk-history-row"><span><strong>Version ${Number(x.version)}</strong>${x.review_note?' · '+safe(x.review_note):''}</span><span>${safe(riskDate(String(x.reviewed_at).slice(0,10)))}</span></div>`).join(''):'<p class="category">No completed reviews recorded yet.</p>';
}
function riskField(label,value,wide=false){return value?`<div class="risk-field ${wide?'wide':''}"><small>${safe(label)}</small><p>${safe(value)}</p></div>`:''}
function renderRiskItems(){
 const q=$('#riskSearch').value.trim().toLowerCase(),filter=$('#riskActionFilter').value;
 const shown=riskItems.filter(x=>{
  const score=Number(x.likelihood)*Number(x.severity);
  return (!q||[x.section_title,x.hazard,x.people_at_risk,x.harm,x.controls,x.monitoring,x.corrective_action,x.action_required,x.action_owner].join(' ').toLowerCase().includes(q))&&(!filter||(filter==='open'&&['open','in_progress'].includes(x.action_status))||(filter==='high'&&score>=12));
 });
 if(!shown.length){$('#riskItems').innerHTML='<div class="handbook-empty">No assessment items match this view.</div>';return}
 $('#riskItems').innerHTML=shown.map(x=>{
  const score=Number(x.likelihood)*Number(x.severity),actionTone=['open','in_progress'].includes(x.action_status)?'due':x.action_status==='complete'?'current':'draft';
  return `<details class="risk-item"><summary><span class="risk-item-title">${safe(x.hazard)}<span class="risk-item-section">${safe(x.section_title)}</span></span><span class="risk-meta"><span class="status-pill ${score>=12?'overdue':'draft'}">Risk ${score}</span>${x.is_ccp?'<span class="status-pill due">CCP</span>':''}</span></summary><div class="risk-item-body"><div class="risk-fields">${riskField('Who might be harmed',x.people_at_risk)}${riskField('How harm may occur',x.harm)}${riskField('Existing controls',x.controls,true)}${riskField('Critical limit',x.critical_limit)}${riskField('Monitoring',x.monitoring)}${riskField('Corrective action',x.corrective_action,true)}${riskField('Further action',x.action_required,true)}<div class="risk-field"><small>Control status</small><p>${safe(x.control_status==='yes'?'In place':x.control_status==='no'?'Not in place':'Not applicable')}</p></div><div class="risk-field"><small>Action status</small><p><span class="status-pill ${actionTone}">${safe(riskActionLabel(x.action_status))}</span>${x.action_owner?' · '+safe(x.action_owner):''}${x.action_due?' · due '+safe(riskDate(x.action_due)):''}</p></div></div><div class="dialog-actions risk-admin"><button class="btn" onclick="editRiskItem('${x.id}')">Edit item</button></div></div></details>`;
 }).join('');
}
function openRiskAssessmentEditor(){
 if(!isAdmin||!riskSelected)return;
 $('#raTitle').value=riskSelected.title;$('#raResponsible').value=riskSelected.responsible_person;$('#raStatus').value=riskSelected.approval_status;$('#raIssueDate').value=riskSelected.issue_date;$('#raReviewDate').value=riskSelected.review_date;$('#raScope').value=riskSelected.scope||'';$('#riskAssessmentEditor').showModal();
}
async function saveRiskAssessment(e){
 e.preventDefault();if(!isAdmin)return;
 const value={title:$('#raTitle').value.trim(),responsible_person:$('#raResponsible').value.trim(),approval_status:'draft',issue_date:$('#raIssueDate').value,review_date:$('#raReviewDate').value,scope:$('#raScope').value.trim(),updated_by:currentUser.id};
 const {error}=await db.from('risk_assessments').update(value).eq('id',riskSelected.id);if(error)return showMessage(error.message);$('#riskAssessmentEditor').close();await loadRiskAssessments();
}
function openRiskItemEditor(item=null){
 if(!isAdmin||!riskSelected)return;riskEditingItem=item?.id||null;$('#riskItemDialogTitle').textContent=item?'Edit hazard or control':'Add hazard or control';
 const values={riSection:item?.section_title||'',riHazard:item?.hazard||'',riPeople:item?.people_at_risk||'',riHarm:item?.harm||'',riControls:item?.controls||'',riLimit:item?.critical_limit||'',riMonitoring:item?.monitoring||'',riCorrective:item?.corrective_action||'',riAction:item?.action_required||'',riOwner:item?.action_owner||'',riDue:item?.action_due||''};Object.entries(values).forEach(([id,value])=>$('#'+id).value=value);
 $('#riControlStatus').value=item?.control_status||'yes';$('#riCcp').checked=!!item?.is_ccp;$('#riLikelihood').value=String(item?.likelihood||3);$('#riSeverity').value=String(item?.severity||3);$('#riActionStatus').value=item?.action_status||'not_required';$('#riskArchiveItem').hidden=!item;$('#riskItemEditor').showModal();
}
window.editRiskItem=id=>openRiskItemEditor(riskItems.find(x=>x.id===id));
async function saveRiskItem(e){
 e.preventDefault();if(!isAdmin)return;
 const value={assessment_id:riskSelected.id,section_title:$('#riSection').value.trim(),hazard:$('#riHazard').value.trim(),people_at_risk:$('#riPeople').value.trim(),harm:$('#riHarm').value.trim(),controls:$('#riControls').value.trim(),control_status:$('#riControlStatus').value,is_ccp:$('#riCcp').checked,critical_limit:$('#riLimit').value.trim(),monitoring:$('#riMonitoring').value.trim(),corrective_action:$('#riCorrective').value.trim(),likelihood:Number($('#riLikelihood').value),severity:Number($('#riSeverity').value),action_required:$('#riAction').value.trim(),action_owner:$('#riOwner').value.trim(),action_due:$('#riDue').value||null,action_status:$('#riActionStatus').value,updated_by:currentUser.id};
 let result;if(riskEditingItem)result=await db.from('risk_items').update(value).eq('id',riskEditingItem);else result=await db.from('risk_items').insert({...value,sort_order:riskItems.length+1,created_by:currentUser.id});if(result.error)return showMessage(result.error.message);await db.from('risk_assessments').update({approval_status:'draft',updated_by:currentUser.id}).eq('id',riskSelected.id);$('#riskItemEditor').close();await loadRiskDetail();await loadRiskAssessments();
}
async function archiveRiskItem(){
 if(!isAdmin||!riskEditingItem||!confirm('Archive this assessment item?'))return;
 const {error}=await db.from('risk_items').update({active:false,updated_by:currentUser.id}).eq('id',riskEditingItem);if(error)return showMessage(error.message);await db.from('risk_assessments').update({approval_status:'draft',updated_by:currentUser.id}).eq('id',riskSelected.id);$('#riskItemEditor').close();await loadRiskDetail();await loadRiskAssessments();
}
async function approveRiskAssessment(){
 if(!isAdmin||!riskSelected)return;const next=Number(riskSelected.version)+1;
 const note=prompt('Optional review note for version '+next+':','Annual review completed');if(note===null)return;
 if(!confirm('Approve and lock a snapshot as version '+next+'?'))return;
 const {data,error}=await db.rpc('approve_risk_assessment',{p_assessment_id:riskSelected.id,p_review_note:note.trim()});if(error)return showMessage(error.message);await loadRiskAssessments();showMessage('Version '+Number(data||next)+' approved and saved to the review history.');
}
async function acknowledgeRiskAssessment(){
 if(!currentUser||!riskSelected||riskAcknowledged)return;
 const {error}=await db.from('risk_acknowledgements').insert({assessment_id:riskSelected.id,user_id:currentUser.id,version:riskSelected.version});if(error)return showMessage(error.message);riskAcknowledged=true;renderRiskDetail();showMessage('Your acknowledgement has been recorded.');
}
function closeRiskDetail(){riskSelected=null;riskItems=[];$('#riskDetail').hidden=true;$('#riskOverview').hidden=false;renderRiskOverview()}
function printRiskAssessment(){document.querySelectorAll('#riskItems .risk-item').forEach(x=>x.open=true);document.body.classList.add('risk-print');window.print()}
window.addEventListener('afterprint',()=>document.body.classList.remove('risk-print'));

$('#riskBack').onclick=closeRiskDetail;$('#riskEditAssessment').onclick=openRiskAssessmentEditor;$('#riskAddItem').onclick=()=>openRiskItemEditor();$('#riskApprove').onclick=approveRiskAssessment;$('#riskAcknowledge').onclick=acknowledgeRiskAssessment;$('#riskPrint').onclick=printRiskAssessment;$('#riskSearch').oninput=renderRiskItems;$('#riskActionFilter').onchange=renderRiskItems;$('#riskAssessmentForm').onsubmit=saveRiskAssessment;$('#riskItemForm').onsubmit=saveRiskItem;$('#riskArchiveItem').onclick=archiveRiskItem;
if(currentUser)loadRiskAssessments();else updateRiskHomeCount();
