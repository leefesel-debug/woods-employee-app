window.WOODS_CONFIG = {
  supabaseUrl: "https://ypquqxolphrocdohcrrg.supabase.co",
  supabaseAnonKey: "sb_publishable_XgzcSnuaGVJcpzWYbIjr7Q_ibysLKJa",
  secureOrderEmail: true,
  orderEmailTestMode: false
};

// Admin-only Cost of Goods entry point for Woods Team Hub.
// The main app sets body.admin only after confirming the signed-in user's
// role from public.profiles, so staff never receive the COGS navigation tile.
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
      if(!email){
        authError.textContent='Enter your email address first, then tap Forgot password?';
        emailInput.focus();
        return;
      }
      forgot.disabled=true;
      const original=forgot.textContent;
      forgot.textContent='Sending…';
      try{
        const client=window.supabase.createClient(window.WOODS_CONFIG.supabaseUrl,window.WOODS_CONFIG.supabaseAnonKey);
        const redirectTo=new URL('v16.html',window.location.href).href.split('?')[0];
        const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo});
        if(error)throw error;
        authError.style.color='#17633a';
        authError.textContent='Password reset email sent. Check your inbox and junk folder.';
      }catch(error){
        authError.style.color='var(--red)';
        authError.textContent=error?.message||'Could not send the reset email. Please try again.';
      }finally{
        forgot.disabled=false;
        forgot.textContent=original;
      }
    });

    emailInput.addEventListener('input',()=>{authError.style.color='var(--red)'});
  }

  // Allergen matrix enhancements: Vegetarian dietary flag and recent-product sorting.
  // Kept here as a lightweight extension so the stable allergen save code remains untouched.
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
    let vegetarian=document.getElementById('vegetarian');
    if(quickFlags&&!vegetarian){
      const label=document.createElement('label');
      label.className='quick-flag';
      label.innerHTML='<input id="vegetarian" type="checkbox"> Vegetarian';
      quickFlags.appendChild(label);
      vegetarian=label.querySelector('input');
      quickFlags.style.gridTemplateColumns='repeat(auto-fit,minmax(145px,1fr))';
    }

    const sort=document.createElement('select');
    sort.className='filter';
    sort.id='productSort';
    sort.setAttribute('aria-label','Sort products');
    sort.innerHTML='<option value="default">Sort: Default</option><option value="recent">Recently added</option><option value="updated">Recently updated</option>';
    toolbar.appendChild(sort);
    toolbar.style.gridTemplateColumns='minmax(240px,1fr) repeat(4,auto)';

    const style=document.createElement('style');
    style.textContent='@media(max-width:760px){#allergenView .toolbar{grid-template-columns:1fr 1fr!important}#allergenView .toolbar .search{grid-column:1/-1}#allergenView #productSort{grid-column:1/-1}.quick-flags{grid-template-columns:1fr!important}}';
    document.head.appendChild(style);

    const client=window.supabase.createClient(window.WOODS_CONFIG.supabaseUrl,window.WOODS_CONFIG.supabaseAnonKey);
    let productMeta=new Map();
    let applying=false;

    const isVegetarianNotes=notes=>/\bVegetarian:\s*Yes\b/i.test(String(notes||''));
    const stripVegetarian=notes=>String(notes||'').split('·').map(x=>x.trim()).filter(x=>x&&!/^Vegetarian:/i.test(x)).join(' · ');
    const cardId=card=>{
      const button=card.querySelector('[onclick*="editItem"]');
      const match=button?.getAttribute('onclick')?.match(/editItem\(['\"]([^'\"]+)['\"]\)/);
      return match?.[1]||'';
    };

    async function loadProductMeta(){
      const {data:{session}}=await client.auth.getSession();
      if(!session){productMeta=new Map();return}
      let result=await client.from('products').select('id,name,notes,created_at,updated_at').eq('active',true);
      if(result.error&&/created_at/i.test(result.error.message||'')){
        result=await client.from('products').select('id,name,notes,updated_at').eq('active',true);
      }
      if(result.error)return;
      productMeta=new Map((result.data||[]).map(x=>[String(x.id),x]));
      applyEnhancements();
    }

    function applyEnhancements(){
      if(applying)return;
      applying=true;
      try{
        const cards=[...grid.querySelectorAll('.card')];
        cards.forEach(card=>{
          const meta=productMeta.get(cardId(card));
          if(!meta)return;
          const dietaryRow=card.querySelector('.dietary');
          if(dietaryRow&&!dietaryRow.querySelector('.diet.vegetarian')){
            const badge=document.createElement('span');
            const yes=isVegetarianNotes(meta.notes);
            badge.className='diet vegetarian '+(yes?'yes':'no');
            badge.textContent=yes?'✓ Vegetarian':'Not vegetarian';
            dietaryRow.appendChild(badge);
          }
          const notesEl=card.querySelector('.notes');
          if(notesEl){const cleaned=stripVegetarian(notesEl.textContent);if(cleaned)notesEl.textContent=cleaned;else notesEl.remove()}
        });

        if(sort.value!=='default'){
          const key=sort.value==='recent'?'created_at':'updated_at';
          const sorted=[...cards].sort((a,b)=>{
            const av=productMeta.get(cardId(a))?.[key]||productMeta.get(cardId(a))?.updated_at||'';
            const bv=productMeta.get(cardId(b))?.[key]||productMeta.get(cardId(b))?.updated_at||'';
            return new Date(bv||0)-new Date(av||0);
          });
          if(sorted.some((card,index)=>card!==cards[index]))sorted.forEach(card=>grid.appendChild(card));
        }

      }finally{applying=false}
    }

    sort.addEventListener('change',applyEnhancements);
    ['search','category','allergen'].forEach(id=>document.getElementById(id)?.addEventListener(id==='search'?'input':'change',()=>setTimeout(applyEnhancements,0)));

    const originalSubmit=editForm.onsubmit;
    editForm.onsubmit=e=>{
      const clean=stripVegetarian(notesInput.value);
      notesInput.value='Vegetarian: '+(vegetarian?.checked?'Yes':'No')+(clean?' · '+clean:'');
      const result=typeof originalSubmit==='function'?originalSubmit.call(editForm,e):undefined;
      Promise.resolve(result).finally(()=>setTimeout(loadProductMeta,250));
      return result;
    };

    const syncEditor=()=>{
      if(!editor.hasAttribute('open')||!vegetarian)return;
      vegetarian.checked=isVegetarianNotes(notesInput.value);
      notesInput.value=stripVegetarian(notesInput.value);
    };
    new MutationObserver(syncEditor).observe(editor,{attributes:true,attributeFilter:['open']});
    new MutationObserver(()=>setTimeout(applyEnhancements,0)).observe(grid,{childList:true,subtree:true});
    client.auth.onAuthStateChange(()=>setTimeout(loadProductMeta,100));
    loadProductMeta();
  }
});
