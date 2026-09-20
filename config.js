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
});
