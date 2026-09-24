window.WOODS_CONFIG = {
  supabaseUrl: "https://ypquqxolphrocdohcrrg.supabase.co",
  supabaseAnonKey: "sb_publishable_XgzcSnuaGVJcpzWYbIjr7Q_ibysLKJa",
  secureOrderEmail: true,
  orderEmailTestMode: false
};

// Admin-only Cost of Goods entry point for Woods Team Hub.
window.addEventListener('DOMContentLoaded',()=>{
  const installCogsAccess=()=>{
    const grid=document.querySelector('.home-grid');
    if(!grid)return;
    let tile=document.getElementById('cogsAdminTile');
    if(document.body.classList.contains('admin')){
      if(!tile){
        tile=document.createElement('button');
        tile.id='cogsAdminTile';
        tile.className='home-tile';
        tile.type='button';
        tile.innerHTML='<div><div class="tile-icon">£</div><h3>Cost of Goods</h3><p>Menu costing, ingredients, recipes and margins.</p></div><span class="tile-status">Admin only</span>';
        tile.addEventListener('click',()=>{window.location.href='cogs.html'});
        grid.appendChild(tile);
      }
    }else if(tile){tile.remove()}
  };
  installCogsAccess();
  new MutationObserver(installCogsAccess).observe(document.body,{attributes:true,attributeFilter:['class']});

  // Self-service password recovery for all staff.
  const authForm=document.getElementById('signInForm');
  const emailInput=document.getElementById('email');
  const authError=document.getElementById('authError');
  if(authForm&&emailInput&&authError){
    const actions=authForm.querySelector('.dialog-actions');
    const forgot=document.createElement('button');
    forgot.type='button';
    forgot.id='forgotPasswordBtn';
    forgot.className='btn';
    forgot.textContent='Forgot password?';
    forgot.style.marginRight='auto';
    actions.prepend(forgot);
    forgot.addEventListener('click',async()=>{
      const email=emailInput.value.trim();
      authError.textContent='';
      if(!email){authError.textContent='Enter your email address first, then tap Forgot password?';emailInput.focus();return}
      forgot.disabled=true;const original=forgot.textContent;forgot.textContent='Sending…';
      try{
        const client=window.supabase.createClient(window.WOODS_CONFIG.supabaseUrl,window.WOODS_CONFIG.supabaseAnonKey);
        const redirectTo=new URL('v16.html',window.location.href).href.split('?')[0];
        const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo});
        if(error)throw error;
        authError.style.color='#17633a';authError.textContent='Password reset email sent. Check your inbox and junk folder.';
      }catch(error){authError.style.color='var(--red)';authError.textContent=error?.message||'Could not send the reset email. Please try again.'}
      finally{forgot.disabled=false;forgot.textContent=original}
    });
    emailInput.addEventListener('input',()=>{authError.style.color='var(--red)'});
  }

  // Allergen matrix enhancements: three-state Vegetarian status and recent-product sorting.
  // Vegan always implies Vegetarian. Existing non-vegan products remain Not confirmed until reviewed.
  const editor=document.getElementById('editor');
  const editForm=document.getElementById('editForm');
  const notesInput=document.getElementById('notes');
  const veganInput=document.getElementById('vegan');
  const glutenFreeInput=document.getElementById('glutenFree');
  const dietary=document.getElementById('dietary');
  const toolbar=document.querySelector('#allergenView .toolbar');
  const grid=document.getElementById('grid');
  if(editor&&editForm&&notesInput&&veganInput&&glutenFreeInput&&dietary&&toolbar&&grid){
    const quickFlags=veganInput.closest('.quick-flags');
    let vegetarianStatus=document.getElementById('vegetarianStatus');
    if(quickFlags&&!vegetarianStatus){
      const label=document.createElement('label');
      label.className='quick-flag vegetarian-control';
      label.innerHTML='<span>Vegetarian</span><select id="vegetarianStatus" aria-label="Vegetarian status"><option value="unknown">Not confirmed</option><option value="yes">Yes</option><option value="no">No</option></select>';
      quickFlags.appendChild(label);
      vegetarianStatus=label.querySelector('select');
      quickFlags.style.gridTemplateColumns='repeat(auto-fit,minmax(145px,1fr))';
    }

    const sort=document.createElement('select');
    sort.className='filter';sort.id='productSort';sort.setAttribute('aria-label','Sort products');
    sort.innerHTML='<option value="default">Sort: Default</option><option value="recent">Recently added</option><option value="updated">Recently changed</option>';
    toolbar.appendChild(sort);toolbar.style.gridTemplateColumns='minmax(240px,1fr) repeat(4,auto)';
    const style=document.createElement('style');
    style.textContent='.vegetarian-control{display:grid!important;grid-template-columns:1fr;gap:5px}.vegetarian-control select{width:100%;border:1px solid #cbd5d0;border-radius:8px;background:#fff;padding:7px 8px;color:var(--ink)}.diet.vegetarian.unknown{background:#eef1ef;color:#66756f;border:1px solid #dfe5e1}@media(max-width:760px){#allergenView .toolbar{grid-template-columns:1fr 1fr!important}#allergenView .toolbar .search{grid-column:1/-1}#allergenView #productSort{grid-column:1/-1}.quick-flags{grid-template-columns:1fr!important}}';
    document.head.appendChild(style);

    const client=window.supabase.createClient(window.WOODS_CONFIG.supabaseUrl,window.WOODS_CONFIG.supabaseAnonKey);
    let productMeta=new Map();
    let productMetaByName=new Map();
    let applying=false;
    let originalOrder=[];

    const vegetarianMarker=notes=>{const m=String(notes||'').match(/\bVegetarian:\s*(Yes|No|Not confirmed)\b/i);if(!m)return'unknown';return/^yes$/i.test(m[1])?'yes':/^no$/i.test(m[1])?'no':'unknown'};
    const isVeganNotes=notes=>/\bVegan:\s*Yes\b/i.test(String(notes||''));
    const vegetarianForNotes=notes=>isVeganNotes(notes)?'yes':vegetarianMarker(notes);
    const stripVegetarian=notes=>String(notes||'').split('·').map(x=>x.trim()).filter(x=>x&&!/^Vegetarian:/i.test(x)).join(' · ');
    const normaliseName=value=>String(value||'').trim().toLocaleLowerCase('en-GB').replace(/\s+/g,' ');
    const cardId=card=>{
      const button=card.querySelector('[onclick*="editItem"]');
      const match=button?.getAttribute('onclick')?.match(/editItem\(['\"]([^'\"]+)['\"]\)/);
      return match?.[1]||'';
    };
    const cardName=card=>normaliseName(card.querySelector('h2')?.textContent||card.querySelector('h3')?.textContent||'');
    const metaForCard=card=>productMeta.get(cardId(card))||productMetaByName.get(cardName(card))||null;
    const cardUpdatedTime=card=>{
      const text=[...card.querySelectorAll('.category')].map(x=>x.textContent||'').find(x=>/Last checked \/ updated:/i.test(x))||'';
      const raw=text.replace(/^.*Last checked \/ updated:\s*/i,'').trim();
      if(!raw||/not yet/i.test(raw))return 0;
      const months={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
      const m=raw.match(/(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})/);
      return m?new Date(Number(m[3]),months[m[2]]??0,Number(m[1])).getTime():0;
    };
    const timeFor=(card,key)=>{
      const meta=metaForCard(card);
      const raw=key==='created_at'?(meta?.created_at||meta?.updated_at):(meta?.updated_at||meta?.created_at);
      const parsed=raw?new Date(raw).getTime():0;
      return Number.isFinite(parsed)&&parsed>0?parsed:cardUpdatedTime(card);
    };

    async function loadProductMeta(){
      let result=await client.from('allergen_products').select('id,name,notes,created_at,updated_at').eq('active',true);
      if(result.error&&/created_at/i.test(result.error.message||''))result=await client.from('allergen_products').select('id,name,notes,updated_at').eq('active',true);
      if(result.error){productMeta=new Map();productMetaByName=new Map();applyEnhancements();return}
      const rows=result.data||[];
      productMeta=new Map(rows.map(x=>[String(x.id),x]));
      productMetaByName=new Map(rows.filter(x=>x.name).map(x=>[normaliseName(x.name),x]));
      applyEnhancements();
    }

    function applyEnhancements(){
      if(applying)return;
      applying=true;
      try{
        const cards=[...grid.querySelectorAll('.card')];
        if(cards.length&&!originalOrder.length)originalOrder=cards.map(card=>cardId(card)||cardName(card)).filter(Boolean);
        cards.forEach(card=>{
          const meta=metaForCard(card);
          if(meta){
            const dietaryRow=card.querySelector('.dietary');
            let badge=dietaryRow?.querySelector('.diet.vegetarian');
            if(dietaryRow&&!badge){badge=document.createElement('span');dietaryRow.appendChild(badge)}
            if(badge){
              const status=vegetarianForNotes(meta.notes);
              badge.className='diet vegetarian '+(status==='yes'?'yes':status==='no'?'no':'unknown');
              badge.textContent=status==='yes'?'✓ Vegetarian':status==='no'?'Not vegetarian':'Vegetarian · Not confirmed';
            }
          }
          const notesEl=card.querySelector('.notes');if(notesEl){const cleaned=stripVegetarian(notesEl.textContent);if(cleaned)notesEl.textContent=cleaned;else notesEl.remove()}
        });

        let sorted=[...cards];
        if(sort.value==='default'&&originalOrder.length){
          const rank=new Map(originalOrder.map((id,index)=>[id,index]));
          sorted.sort((a,b)=>(rank.get(cardId(a)||cardName(a))??999999)-(rank.get(cardId(b)||cardName(b))??999999));
        }else if(sort.value==='recent'){
          sorted.sort((a,b)=>timeFor(b,'created_at')-timeFor(a,'created_at'));
        }else if(sort.value==='updated'){
          sorted.sort((a,b)=>timeFor(b,'updated_at')-timeFor(a,'updated_at'));
        }
        if(sorted.some((card,index)=>card!==cards[index]))sorted.forEach(card=>grid.appendChild(card));
      }finally{applying=false}
    }

    sort.addEventListener('change',async()=>{sort.disabled=true;try{await loadProductMeta();applyEnhancements()}finally{sort.disabled=false}});
    ['search','category','allergen'].forEach(id=>document.getElementById(id)?.addEventListener(id==='search'?'input':'change',()=>setTimeout(applyEnhancements,0)));

    // Vegan is a subset of vegetarian: selecting Vegan automatically locks Vegetarian to Yes.
    const syncVeganVegetarian=()=>{
      if(!vegetarianStatus)return;
      if(veganInput.checked){vegetarianStatus.value='yes';vegetarianStatus.disabled=true}
      else vegetarianStatus.disabled=false;
    };
    veganInput.addEventListener('change',()=>{
      if(veganInput.checked&&vegetarianStatus)vegetarianStatus.value='yes';
      syncVeganVegetarian();
    });

    const originalSubmit=editForm.onsubmit;
    editForm.onsubmit=e=>{
      const clean=stripVegetarian(notesInput.value);
      const status=veganInput.checked?'yes':(vegetarianStatus?.value||'unknown');
      const marker=status==='yes'?'Yes':status==='no'?'No':'Not confirmed';
      notesInput.value='Vegetarian: '+marker+(clean?' · '+clean:'');
      const result=typeof originalSubmit==='function'?originalSubmit.call(editForm,e):undefined;
      Promise.resolve(result).finally(()=>setTimeout(loadProductMeta,250));return result;
    };

    const syncEditor=()=>{
      if(!editor.hasAttribute('open')||!vegetarianStatus)return;
      const existing=vegetarianForNotes(notesInput.value);
      vegetarianStatus.value=veganInput.checked?'yes':existing;
      notesInput.value=stripVegetarian(notesInput.value);
      syncVeganVegetarian();
    };
    new MutationObserver(syncEditor).observe(editor,{attributes:true,attributeFilter:['open']});
    new MutationObserver(()=>setTimeout(applyEnhancements,0)).observe(grid,{childList:true,subtree:true});
    client.auth.onAuthStateChange(()=>setTimeout(loadProductMeta,100));
    loadProductMeta();
  }
});
