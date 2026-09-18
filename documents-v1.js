let documents=[],editingDocument=null;
const DOCUMENT_BUCKET='shop-documents';
const DOCUMENT_TYPES={
 'application/pdf':'PDF',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'DOCX',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'XLSX',
 'text/csv':'CSV'
};
const DOCUMENT_EXTENSIONS={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv'};

function documentMime(file){return file.type||DOCUMENT_EXTENSIONS[String(file.name||'').split('.').pop().toLowerCase()]||''}
function documentDate(value){return value?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value)):'—'}

function updateDocumentsHomeCount(){
 const el=$('#homeDocumentCount');if(!el)return;
 el.textContent=currentUser?(documents.length+' document'+(documents.length===1?'':'s')):'Sign in to view';
}
async function loadDocuments(){
 const setup=$('#documentsSetupMessage');
 if(!currentUser){documents=[];setup.innerHTML='<div class="handbook-empty"><strong>Sign in to view forms and templates.</strong></div>';renderDocuments();updateDocumentsHomeCount();return}
 const {data,error}=await db.from('document_templates').select('id,title,category,frequency,description,current_version,current_storage_path,current_file_name,current_mime_type,current_file_size,active,updated_at').eq('active',true).order('category').order('title');
 if(error){documents=[];setup.innerHTML='<div class="handbook-empty"><strong>Document repository setup is not complete yet.</strong><br>Run <code>supabase-documents.sql</code> in the <a href="https://supabase.com/dashboard/project/ypquqxolphrocdohcrrg/sql/new" target="_blank" rel="noopener">Supabase SQL Editor</a>.</div>';renderDocuments();updateDocumentsHomeCount();return}
 setup.innerHTML='';documents=data||[];renderDocuments();updateDocumentsHomeCount();
}
function refreshDocumentCategories(){
 const categories=[...new Set(documents.map(x=>x.category).filter(Boolean))].sort(),filter=$('#documentCategory'),current=filter.value;
 filter.innerHTML='<option value="">All categories</option>'+categories.map(x=>`<option>${safe(x)}</option>`).join('');filter.value=categories.includes(current)?current:'';
 $('#documentCategoryOptions').innerHTML=categories.map(x=>`<option value="${safe(x)}">`).join('');
}
function readableSize(value){
 const bytes=Number(value||0);if(!bytes)return '';
 return bytes<1024*1024?Math.ceil(bytes/1024)+' KB':(bytes/1024/1024).toFixed(1)+' MB';
}
function documentType(item){return DOCUMENT_TYPES[item.current_mime_type]||String(item.current_file_name||'FILE').split('.').pop().toUpperCase()}
function renderDocuments(){
 refreshDocumentCategories();const q=$('#documentSearch').value.trim().toLowerCase(),category=$('#documentCategory').value;
 const shown=documents.filter(x=>(!category||x.category===category)&&(!q||[x.title,x.category,x.frequency,x.description,x.current_file_name].join(' ').toLowerCase().includes(q)));
 $('#documentCount').textContent=shown.length+' document'+(shown.length===1?'':'s');
 if(!currentUser){$('#documentsGrid').innerHTML='';return}
 if(!shown.length){$('#documentsGrid').innerHTML='<div class="handbook-empty">'+(documents.length?'No documents match that search.':isAdmin?'No documents yet. Upload the Woods forms above.':'No forms or templates are currently available.')+'</div>';return}
 $('#documentsGrid').innerHTML=shown.map(x=>{
  const isPdf=x.current_mime_type==='application/pdf';
  return `<article class="doc-card"><div class="doc-card-head"><div class="doc-icon">${safe(documentType(x))}</div><div><h3>${safe(x.title)}</h3><p>${safe(x.category)}${x.frequency?' · '+safe(x.frequency):''}</p></div></div>${x.description?`<p>${safe(x.description)}</p>`:''}<div class="file-meta">Version ${Number(x.current_version)}${x.current_file_size?' · '+safe(readableSize(x.current_file_size)):''} · updated ${safe(documentDate(x.updated_at))}</div><div class="doc-card-actions"><button class="btn primary" onclick="openShopDocument('${x.id}',false)">${isPdf?'Open / print':'Open file'}</button><button class="btn" onclick="openShopDocument('${x.id}',true)">Download</button></div><div class="doc-admin-actions"><button class="mini" onclick="editShopDocument('${x.id}')">Edit / replace</button><button class="mini danger" onclick="archiveShopDocument('${x.id}')">Archive</button></div></article>`;
 }).join('');
}
window.openShopDocument=async(id,download)=>{
 const item=documents.find(x=>x.id===id);if(!item)return;
 const newTab=window.open('about:blank','_blank');
 const options=download?{download:item.current_file_name}:{};
 const {data,error}=await db.storage.from(DOCUMENT_BUCKET).createSignedUrl(item.current_storage_path,120,options);
 if(error){if(newTab)newTab.close();return showMessage(error.message)}
 if(newTab)newTab.location=data.signedUrl;else window.location.href=data.signedUrl;
};
function inferDocument(file){
 const base=file.name.replace(/\.[^.]+$/,'').replace(/[_]+/g,' ').replace(/\s+/g,' ').trim(),lower=base.toLowerCase();
 let category='General',frequency='',title=base,description='Printable Woods shop form.';
 if(lower.startsWith('foh')){category='Front of House';description='Front of House operational checklist.'}
 else if(lower.startsWith('kitchen')){category='Kitchen';description='Kitchen cleaning and safety checklist.'}
 else if(lower.includes('toilet')){category='Toilets & Hygiene';description='Daily toilet cleanliness, consumables, safety and accessibility checklist.'}
 if(lower.includes('opening'))frequency='Opening';else if(lower.includes('closing'))frequency='Closing';else if(lower.includes('weekly'))frequency='Weekly';else if(lower.includes('daily')||lower.includes('toilet'))frequency='Daily';
 if(lower.includes('foh')&&lower.includes('opening'))title='FOH Opening Checklist';
 else if(lower.includes('foh')&&lower.includes('closing'))title='FOH Closing Checklist';
 else if(lower.includes('foh')&&lower.includes('weekly'))title='FOH Weekly Cleaning Checklist';
 else if(lower.includes('kitchen')&&lower.includes('daily'))title='Kitchen Daily Cleaning Checklist';
 else if(lower.includes('kitchen')&&lower.includes('weekly'))title='Kitchen Weekly Cleaning Checklist';
 else if(lower.includes('toilet'))title='Daily Toilet Checklist';
 return{title,category,frequency,description};
}
function validateDocumentFile(file){
 if(!file)throw new Error('Choose a file first.');
 const allowed=Object.keys(DOCUMENT_TYPES);if(!allowed.includes(documentMime(file)))throw new Error(file.name+': use a PDF, Word, Excel or CSV file.');
 if(file.size>10*1024*1024)throw new Error(file.name+': the maximum file size is 10 MB.');
}
function storageFileName(name){return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').toLowerCase()||'document'}
async function storeDocumentFile(templateId,file,version){
 validateDocumentFile(file);const path=templateId+'/v'+version+'-'+Date.now()+'-'+storageFileName(file.name);
 const {error}=await db.storage.from(DOCUMENT_BUCKET).upload(path,file,{contentType:documentMime(file),upsert:false,cacheControl:'3600'});if(error)throw error;return path;
}
async function createDocument(file,meta){
 const id=crypto.randomUUID(),path=await storeDocumentFile(id,file,1);
 const mime=documentMime(file),row={id,...meta,current_version:1,current_storage_path:path,current_file_name:file.name,current_mime_type:mime,current_file_size:file.size,active:true,created_by:currentUser.id,updated_by:currentUser.id};
 const {error}=await db.from('document_templates').insert(row);
 if(error){await db.storage.from(DOCUMENT_BUCKET).remove([path]);throw error}
 const {error:versionError}=await db.from('document_template_versions').insert({template_id:id,version:1,storage_path:path,file_name:file.name,mime_type:mime,file_size:file.size,uploaded_by:currentUser.id});
 if(versionError){await db.from('document_templates').delete().eq('id',id);await db.storage.from(DOCUMENT_BUCKET).remove([path]);throw versionError}
}
async function replaceDocument(item,file,meta){
 const version=Number(item.current_version)+1,path=await storeDocumentFile(item.id,file,version),mime=documentMime(file);
 const {error:versionError}=await db.from('document_template_versions').insert({template_id:item.id,version,storage_path:path,file_name:file.name,mime_type:mime,file_size:file.size,uploaded_by:currentUser.id});
 if(versionError){await db.storage.from(DOCUMENT_BUCKET).remove([path]);throw versionError}
 const {error}=await db.from('document_templates').update({...meta,current_version:version,current_storage_path:path,current_file_name:file.name,current_mime_type:mime,current_file_size:file.size,updated_by:currentUser.id}).eq('id',item.id);
 if(error){await db.from('document_template_versions').delete().eq('template_id',item.id).eq('version',version);await db.storage.from(DOCUMENT_BUCKET).remove([path]);throw error}
}
async function bulkUploadDocuments(){
 if(!isAdmin)return;const files=[...$('#bulkDocumentFiles').files];if(!files.length)return showMessage('Choose the Woods form PDFs first.');
 const button=$('#bulkDocumentUpload');button.disabled=true;
 try{
  for(let i=0;i<files.length;i++){
   const file=files[i],meta=inferDocument(file),existing=documents.find(x=>x.title.toLowerCase()===meta.title.toLowerCase());button.textContent='Uploading '+(i+1)+' of '+files.length+'…';
   if(existing)await replaceDocument(existing,file,meta);else await createDocument(file,meta);
  }
  $('#bulkDocumentFiles').value='';await loadDocuments();showMessage(files.length+' form'+(files.length===1?'':'s')+' uploaded to the secure repository.');
 }catch(e){showMessage(e.message)}finally{button.disabled=false;button.textContent='Upload selected'}
}
function openDocumentEditor(item=null){
 if(!isAdmin)return;editingDocument=item?.id||null;$('#documentDialogTitle').textContent=item?'Edit or replace document':'Add form or template';$('#documentTitle').value=item?.title||'';$('#documentCategoryEdit').value=item?.category||'';$('#documentFrequency').value=item?.frequency||'';$('#documentDescription').value=item?.description||'';$('#documentFile').value='';$('#documentFile').required=!item;$('#documentFileHelp').textContent=item?'Choose a new file only if you want to create version '+(Number(item.current_version)+1)+'.':'Choose the latest file.';$('#documentEditor').showModal();
}
window.editShopDocument=id=>openDocumentEditor(documents.find(x=>x.id===id));
async function saveDocument(e){
 e.preventDefault();if(!isAdmin)return;const button=$('#saveDocument'),file=$('#documentFile').files[0],meta={title:$('#documentTitle').value.trim(),category:$('#documentCategoryEdit').value.trim(),frequency:$('#documentFrequency').value.trim(),description:$('#documentDescription').value.trim()};button.disabled=true;button.textContent='Saving…';
 try{
  if(editingDocument){const item=documents.find(x=>x.id===editingDocument);if(file)await replaceDocument(item,file,meta);else{const {error}=await db.from('document_templates').update({...meta,updated_by:currentUser.id}).eq('id',item.id);if(error)throw error}}
  else await createDocument(file,meta);
  $('#documentEditor').close();await loadDocuments();
 }catch(err){showMessage(err.message)}finally{button.disabled=false;button.textContent='Save document'}
}
window.archiveShopDocument=async id=>{if(!isAdmin)return;const item=documents.find(x=>x.id===id);if(!item||!confirm('Archive '+item.title+'? Staff will no longer see it, but its file history will be retained.'))return;const {error}=await db.from('document_templates').update({active:false,updated_by:currentUser.id}).eq('id',id);if(error)return showMessage(error.message);await loadDocuments()};

$('#documentSearch').oninput=renderDocuments;$('#documentCategory').onchange=renderDocuments;$('#bulkDocumentUpload').onclick=bulkUploadDocuments;$('#addDocument').onclick=()=>openDocumentEditor();$('#documentForm').onsubmit=saveDocument;
if(currentUser)loadDocuments();else updateDocumentsHomeCount();
