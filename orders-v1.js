let orderSuppliers=[],orderSupplier=null,orderCatalogue=[],purchaseOrders=[],purchaseOrderLines=[];
const ORDERS_SQL='https://supabase.com/dashboard/project/ypquqxolphrocdohcrrg/sql/new';
function secureOrderEmailEnabled(){return window.WOODS_CONFIG?.secureOrderEmail===true}

function orderLocalDate(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return`${y}-${m}-${d}`}
function orderTomorrow(){const d=new Date();d.setDate(d.getDate()+1);return orderLocalDate(d)}
function orderDefaultDelivery(){if(orderSupplier?.name!=='Monsoon Estates')return orderTomorrow();const d=new Date(),days=(3-d.getDay()+7)%7;d.setDate(d.getDate()+(days||7));return orderLocalDate(d)}
function orderGreeting(){return orderSupplier?.name==='Monsoon Estates'?'Anne':'team'}
function orderDeliveryText(value){const tomorrow=orderTomorrow();if(value===tomorrow)return'tomorrow';return new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long'}).format(new Date(value+'T12:00:00'))}
function selectedOrderLines(){return orderCatalogue.map(item=>{const quantity=Number(document.querySelector(`[data-order-item="${item.id}"]`)?.value||0);return quantity>0?{...item,quantity,order_phrase:`${quantity} ${quantity===1?item.singular_phrase:item.plural_phrase}`}:null}).filter(Boolean)}
function orderEmail(){
 const lines=selectedOrderLines(),delivery=$('#orderDelivery').value||orderDefaultDelivery();
 const list=lines.map(x=>`- ${x.order_phrase}`).join('\n');
 return{lines,delivery,subject:orderSupplier?.email_subject||'Woods Coffee Shop',body:`Hi ${orderGreeting()},\n\nPlease could I order the following for delivery ${orderDeliveryText(delivery)}:\n\n${list}\n\nThanks,\nWoods`};
}
function renderOrderPreview(){const email=orderEmail(),button=$('#openOrderEmail'),cc=$('#orderPreviewCc'),ccLabel=$('#orderPreviewCcLabel');$('#orderPreviewTo').textContent=orderSupplier?.email||'';cc.textContent=(orderSupplier?.cc_email||'').split(',').join(', ');cc.hidden=!orderSupplier?.cc_email;ccLabel.hidden=!orderSupplier?.cc_email;$('#orderPreviewSubject').textContent=email.subject;$('#orderPreviewBody').textContent=email.body;button.disabled=!email.lines.length;button.textContent=secureOrderEmailEnabled()?'Send order from Woods':'Open in Outlook';const note=$('#orderSendNote');if(note)note.textContent=secureOrderEmailEnabled()?'The order will be sent securely from hello@woodscoffeeshop.co.uk after confirmation.':'This will not send automatically. Outlook will open so the order can be checked and sent deliberately.'}
function orderOutlookUrl(order,email){const cc=order?.supplier_cc_email||orderSupplier?.cc_email,params=[`to=${encodeURIComponent(order?.supplier_email||orderSupplier.email)}`];if(cc)params.push(`cc=${encodeURIComponent(cc)}`);params.push(`subject=${encodeURIComponent(email.subject||order.email_subject)}`);params.push(`body=${encodeURIComponent(email.body||order.email_body)}`);return`ms-outlook://compose?${params.join('&')}`}
async function loadOrders(preferredSupplierId){
 if(!currentUser){orderSuppliers=[];orderSupplier=null;orderCatalogue=[];purchaseOrders=[];renderOrders();return}
 const supplierResult=await db.from('order_suppliers').select('*').eq('active',true).order('name');
 if(supplierResult.error||!supplierResult.data?.length){orderSuppliers=[];orderSupplier=null;orderCatalogue=[];purchaseOrders=[];renderOrders(true);return}
 orderSuppliers=supplierResult.data;const wanted=preferredSupplierId||orderSupplier?.id;orderSupplier=orderSuppliers.find(x=>x.id===wanted)||orderSuppliers[0];
 await loadSelectedOrderSupplier();
}
async function loadSelectedOrderSupplier(){
 const [itemsResult,ordersResult]=await Promise.all([
  db.from('order_items').select('*').eq('supplier_id',orderSupplier.id).eq('active',true).order('sort_order'),
  db.from('purchase_orders').select('*').eq('supplier_id',orderSupplier.id).eq('active',true).order('created_at',{ascending:false}).limit(20)
 ]);
 orderCatalogue=itemsResult.data||[];purchaseOrders=ordersResult.data||[];
 if(purchaseOrders.length){const lineResult=await db.from('purchase_order_lines').select('*').in('order_id',purchaseOrders.map(x=>x.id)).order('id');purchaseOrderLines=lineResult.data||[]}else purchaseOrderLines=[];
 renderOrders();
}
function renderOrders(setup=false){
 const setupEl=$('#ordersSetupMessage');if(!currentUser){setupEl.innerHTML='';$('#orderItems').innerHTML='';$('#recentOrders').innerHTML='<div class="handbook-empty"><strong>Sign in to prepare supplier orders.</strong></div>';return}
 setupEl.innerHTML=setup?`<div class="privacy-note"><strong>Finish Orders setup.</strong> Run <code>supabase-orders.sql</code> in the <a href="${ORDERS_SQL}" target="_blank" rel="noopener">Supabase SQL Editor</a>.</div>`:'';
 if(setup){$('#orderItems').innerHTML='';$('#recentOrders').innerHTML='';return}
 if(!$('#orderDelivery').value)$('#orderDelivery').value=orderDefaultDelivery();
 const select=$('#orderSupplierSelect');select.innerHTML=orderSuppliers.map(x=>`<option value="${x.id}"${x.id===orderSupplier.id?' selected':''}>${safe(x.name)}</option>`).join('');select.onchange=async()=>{orderSupplier=orderSuppliers.find(x=>x.id===select.value)||orderSupplier;$('#orderDelivery').value=orderDefaultDelivery();await loadSelectedOrderSupplier()};
 $('#orderSupplierName').textContent=orderSupplier.name;$('#orderSupplierEmail').textContent=orderSupplier.email+(orderSupplier.cc_email?` · CC ${orderSupplier.cc_email}`:'');
 $('#orderItems').innerHTML=orderCatalogue.map(x=>`<label class="order-item"><span><strong>${safe(x.item_name)}</strong><small>${safe(orderItemUnit(x))}</small></span><input type="number" min="0" max="99" step="1" value="0" inputmode="numeric" data-order-item="${x.id}" aria-label="Quantity for ${safe(x.item_name)}"></label>`).join('');
 document.querySelectorAll('[data-order-item]').forEach(x=>x.oninput=renderOrderPreview);renderOrderPreview();renderRecentOrders();updateOrdersHomeCount();
}
function orderItemUnit(item){const phrase=item.singular_phrase.toLowerCase();if(phrase.startsWith('pack of 2'))return'Ordered in packs of 2';if(phrase.startsWith('packet of'))return'Ordered by the packet';if(phrase.startsWith('pack of'))return'Ordered by the pack';if(phrase.startsWith('bag of'))return'Ordered by the bag';if(phrase.startsWith('bottle of'))return'Ordered by the bottle';return'Ordered individually'}
function orderStatusLabel(status){return status==='sent'?'Sent':status==='sending'?'Sending…':status==='cancelled'?'Cancelled':'Email prepared'}
function renderRecentOrders(){
 $('#orderCount').textContent=purchaseOrders.length+' recent order'+(purchaseOrders.length===1?'':'s');
 $('#recentOrders').innerHTML=purchaseOrders.length?purchaseOrders.map(order=>{const lines=purchaseOrderLines.filter(x=>x.order_id===order.id);const mine=order.created_by===currentUser?.id,secure=secureOrderEmailEnabled(),canManage=mine||isAdmin;return`<article class="order-history-card"><div class="order-history-head"><div><span class="status-pill ${order.status==='cancelled'?'overdue':order.status==='prepared'?'due':''}">${orderStatusLabel(order.status)}</span><h3>${safe(order.supplier_name)}</h3><p>Delivery ${safe(orderDeliveryText(order.delivery_date))} · ${safe(new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(order.created_at)))}</p></div><div class="order-history-actions">${secure&&order.status==='prepared'&&canManage?`<button class="mini" onclick="sendPreparedOrder('${order.id}')">Send from Woods</button>`:!secure?`<button class="mini" onclick="reopenOrderEmail('${order.id}')">Open in Outlook</button>${order.status==='prepared'&&canManage?`<button class="mini" onclick="markOrderSent('${order.id}')">Mark sent</button>`:''}`:''}${order.status!=='cancelled'&&order.status!=='sent'&&order.status!=='sending'&&canManage?`<button class="mini danger" onclick="cancelOrder('${order.id}')">Cancel</button>`:''}</div></div><div class="order-line-summary">${lines.map(x=>safe(x.order_phrase)).join(' · ')||safe(order.email_body)}</div></article>`}).join(''):`<div class="handbook-empty">No ${safe(orderSupplier.name)} orders have been prepared yet.</div>`;
}
async function prepareOrderEmail(){
 if(!currentUser||!orderSupplier)return;const email=orderEmail();if(!email.lines.length)return showMessage('Choose at least one item and quantity.');
 if(secureOrderEmailEnabled()&&!confirm(`Send this order now from hello@woodscoffeeshop.co.uk to ${orderSupplier.email}?`))return;
 const button=$('#openOrderEmail');button.disabled=true;button.textContent='Preparing…';
 const value={supplier_id:orderSupplier.id,supplier_name:orderSupplier.name,supplier_email:orderSupplier.email,supplier_cc_email:orderSupplier.cc_email||null,delivery_date:email.delivery,email_subject:email.subject,email_body:email.body,status:'prepared',email_opened_at:new Date().toISOString(),created_by:currentUser.id,updated_by:currentUser.id};
 const {data:order,error}=await db.from('purchase_orders').insert(value).select().single();
 if(error){button.disabled=false;button.textContent='Open in Outlook';return showMessage(error.message)}
 const lines=email.lines.map(x=>({order_id:order.id,supplier_item_id:x.id,item_name:x.item_name,quantity:x.quantity,order_phrase:x.order_phrase}));
 const lineResult=await db.from('purchase_order_lines').insert(lines);button.disabled=false;button.textContent='Open in Outlook';
 if(lineResult.error){await db.from('purchase_orders').update({active:false,status:'cancelled',updated_by:currentUser.id}).eq('id',order.id);return showMessage(lineResult.error.message)}
 if(secureOrderEmailEnabled())return performSecureOrderSend(order.id,button);
 const supplierId=orderSupplier.id,outlookUrl=orderOutlookUrl(value,email);await loadOrders(supplierId);window.location.href=outlookUrl;
}
async function performSecureOrderSend(id,button=$('#openOrderEmail')){
 button.disabled=true;button.textContent='Sending securely…';
 const{data,error}=await db.functions.invoke('send-supplier-order',{body:{order_id:id}});
 button.disabled=false;button.textContent='Send order from Woods';await loadOrders();
 if(error||!data?.sent)return showMessage('The email was not sent. The order has been saved as prepared so it can be retried. '+(data?.error||error?.message||''));
 showMessage('Order sent from hello@woodscoffeeshop.co.uk.');
}
window.reopenOrderEmail=id=>{const order=purchaseOrders.find(x=>x.id===id);if(order)window.location.href=orderOutlookUrl(order,{})};
window.markOrderSent=async id=>{if(!confirm('Confirm that this order has been sent from the Woods mailbox?'))return;const{error}=await db.from('purchase_orders').update({status:'sent',sent_at:new Date().toISOString(),updated_by:currentUser.id}).eq('id',id);if(error)return showMessage(error.message);await loadOrders()};
window.sendPreparedOrder=async id=>{const order=purchaseOrders.find(x=>x.id===id);if(!order||!confirm(`Send this prepared order now from hello@woodscoffeeshop.co.uk to ${order.supplier_email}?`))return;await performSecureOrderSend(id)};
window.cancelOrder=async id=>{if(!confirm('Cancel this order record? This does not recall an email already sent.'))return;const{error}=await db.from('purchase_orders').update({status:'cancelled',updated_by:currentUser.id}).eq('id',id);if(error)return showMessage(error.message);await loadOrders()};
function updateOrdersHomeCount(){const open=purchaseOrders.filter(x=>x.status==='prepared').length;const el=$('#homeOrderCount');if(el)el.textContent=currentUser?(open?open+' awaiting confirmation':'Prepare order'):'Sign in to order'}
window.loadOrders=loadOrders;
