let activityRows=[],activityProfiles=new Map(),activitySetupMissing=false;
const ACTIVITY_SQL='https://supabase.com/dashboard/project/ypquqxolphrocdohcrrg/sql/new';

function activityData(row){return row.new_data||row.previous_data||{}}
function activityActor(id){return activityProfiles.get(id)||('Staff · '+String(id||'system').replace(/-/g,'').slice(0,7).toUpperCase())}
function activitySection(table,row){
 if(table==='operations_audit')return{key:row.record_type,label:{key_contacts:'Key contacts',complaint_records:'Complaints',accident_records:'Accidents'}[row.record_type]||'Operations'};
 return{
  product_audit:{key:'allergens',label:'Allergen matrix'},booking_audit:{key:'bookings',label:'Table bookings'},document_audit:{key:'documents',label:'Forms & templates'},
  order_audit:{key:'orders',label:'Supplier orders'},coshh_audit:{key:'coshh',label:'COSHH'},training_audit:{key:'training',label:'Training log'},risk_audit:{key:'risk',label:'Risk assessments'},handbook_audit:{key:'handbook',label:'Staff handbook'}
 }[table]||{key:table,label:table};
}
function activityName(table,row){
 const d=activityData(row);
 if(table==='product_audit')return d.name||'Product';
 if(table==='booking_audit')return d.customer_name?`${d.customer_name}${d.booking_date?' · '+d.booking_date:''}${d.booking_time?' '+String(d.booking_time).slice(0,5):''}`:'Table booking';
 if(table==='order_audit')return `${d.supplier_name||'Supplier'} order`;
 if(table==='document_audit')return d.title||d.current_file_name||'Document';
 if(table==='coshh_audit')return d.product_name||'COSHH product';
 if(table==='training_audit')return [d.person_name,d.training_name].filter(Boolean).join(' · ')||'Training record';
 if(table==='handbook_audit')return d.title||'Handbook section';
 if(table==='risk_audit')return d.title||d.hazard||d.section_title||'Risk-assessment record';
 if(table==='operations_audit')return d.organisation||d.customer_name||d.person_name||'Operations record';
 return 'Record';
}
function activityRecordId(table,row){return String(row.product_id||row.booking_id||row.order_id||row.template_id||row.training_record_id||row.section_id||row.record_id||row.id)}
function activityAction(action){return({created:'Added',updated:'Updated',deleted:'Deleted',archived:'Archived',sent:'Sent',cancelled:'Cancelled'}[action]||String(action||'Changed').replace(/_/g,' '))}
function activityDate(value){return new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}

async function loadActivity(){
 if(!isAdmin){activityRows=[];renderActivity();return}
 $('#activityState').textContent='Loading activity…';activitySetupMissing=false;
 const profiles=await db.from('profiles').select('id,display_name');
 activityProfiles=new Map((profiles.data||[]).map(x=>[x.id,x.display_name||'Staff member']));
 const sources=[
  ['product_audit','id,product_id,action,changed_at,changed_by,previous_data,new_data'],
  ['booking_audit','id,booking_id,action,changed_at,changed_by,previous_data,new_data'],
  ['order_audit','id,order_id,action,changed_at,changed_by,previous_data,new_data'],
  ['document_audit','id,template_id,action,changed_at,changed_by,previous_data,new_data'],
  ['coshh_audit','id,product_id,action,changed_at,changed_by,previous_data,new_data'],
  ['training_audit','id,training_record_id,action,changed_at,changed_by,previous_data,new_data'],
  ['risk_audit','id,table_name,record_id,action,changed_at,changed_by,previous_data,new_data'],
  ['handbook_audit','id,section_id,action,changed_at,changed_by,previous_data,new_data'],
  ['operations_audit','id,record_type,record_id,action,changed_at,changed_by,previous_data,new_data']
 ];
 const results=await Promise.all(sources.map(async([table,fields])=>{
  const result=await db.from(table).select(fields).order('changed_at',{ascending:false}).limit(250);
  if(result.error){if(['booking_audit','handbook_audit'].includes(table))activitySetupMissing=true;return[]}
  return(result.data||[]).map(row=>({table,...row}));
 }));
 let acknowledgements=[];
 const ack=await db.from('risk_acknowledgements').select('id,assessment_id,user_id,version,acknowledged_at').order('acknowledged_at',{ascending:false}).limit(250);
 if(!ack.error)acknowledgements=(ack.data||[]).map(row=>({table:'risk_acknowledgements',id:row.id,record_id:row.assessment_id,action:'acknowledged',changed_at:row.acknowledged_at,changed_by:row.user_id,new_data:{version:row.version}}));
 activityRows=[...results.flat(),...acknowledgements].sort((a,b)=>new Date(b.changed_at)-new Date(a.changed_at)).slice(0,500);
 $('#activityState').textContent=activitySetupMissing?'Activity setup required':'Audit trail · up to date';
 renderActivity();
}
function renderActivity(){
 const list=$('#activityList'),setup=$('#activitySetupMessage');if(!list)return;
 if(!isAdmin){list.innerHTML='<div class="handbook-empty"><strong>Administrator access is required.</strong></div>';return}
 setup.innerHTML=activitySetupMissing?`<div class="privacy-note"><strong>Finish Activity Log setup.</strong> Run <code>supabase-activity.sql</code> in the <a href="${ACTIVITY_SQL}" target="_blank" rel="noopener">Supabase SQL Editor</a> to add booking and handbook history plus automatic staff profiles.</div>`:'';
 const q=$('#activitySearch').value.trim().toLowerCase(),section=$('#activitySection').value,days=Number($('#activityPeriod').value||0),cutoff=days?Date.now()-days*86400000:0;
 const shown=activityRows.map(row=>{
  const meta=row.table==='risk_acknowledgements'?{key:'risk',label:'Risk assessments'}:activitySection(row.table,row);
  const name=row.table==='risk_acknowledgements'?`Assessment acknowledgement · version ${row.new_data?.version||''}`:activityName(row.table,row);
  const actor=activityActor(row.changed_by);return{row,meta,name,actor};
 }).filter(x=>(!section||x.meta.key===section)&&(!cutoff||new Date(x.row.changed_at).getTime()>=cutoff)&&(!q||[x.actor,x.meta.label,x.name,x.row.action].join(' ').toLowerCase().includes(q)));
 $('#activityCount').textContent=shown.length+' event'+(shown.length===1?'':'s');
 list.innerHTML=shown.length?shown.map(({row,meta,name,actor})=>`<article class="activity-card"><div class="activity-main"><span class="status-pill ${row.action==='deleted'||row.action==='archived'?'overdue':''}">${safe(activityAction(row.action))}</span><div><h3>${safe(name)}</h3><p>${safe(meta.label)} · ${safe(activityRecordId(row.table,row).slice(0,12))}</p></div></div><div class="activity-who"><strong>${safe(actor)}</strong><span>${safe(activityDate(row.changed_at))}</span></div></article>`).join(''):'<div class="handbook-empty">No activity matches these filters.</div>';
}
window.loadActivity=loadActivity;
