(()=>{
  const boot=()=>{
    const grid=document.querySelector('.home-grid');
    const nav=document.querySelector('header nav');
    if(!grid||!nav)return;

    if(!document.getElementById('staffingHomeStyle')){
      const style=document.createElement('style');
      style.id='staffingHomeStyle';
      style.textContent=`
        .staffing-today{max-width:860px;margin:0 auto 13px;background:#fff;border:1px solid var(--line);border-left:5px solid var(--green);border-radius:14px;padding:14px 16px;box-shadow:0 5px 18px rgba(50,72,53,.08);cursor:pointer}
        .staffing-today-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.staffing-today h3{margin:0;font-size:.98rem}.staffing-today-date{color:var(--muted);font-size:.78rem;font-weight:700}.staffing-today-body{margin-top:8px;color:var(--ink);font-size:.86rem;line-height:1.5}.staffing-today-body strong{color:var(--green-dark)}.staffing-today.closed{border-left-color:var(--red)}
        @media(max-width:680px){.staffing-today{margin:0 3px 13px;padding:12px 13px}.staffing-today-head{align-items:flex-start}.staffing-today-body{font-size:.82rem}}
      `;
      document.head.appendChild(style);
    }

    if(!document.getElementById('staffingTab')){
      const bookingsTab=document.getElementById('bookingsTab');
      const tab=document.createElement('button');
      tab.className='tab';tab.id='staffingTab';tab.type='button';tab.textContent='Staffing';
      tab.addEventListener('click',()=>{window.location.href='staffing.html'});
      bookingsTab?.after(tab);
    }

    if(!document.getElementById('staffingHomeTile')){
      const bookingTile=[...grid.querySelectorAll('.home-tile')].find(x=>x.textContent.includes('Table bookings'));
      const tile=document.createElement('button');
      tile.className='home-tile';tile.id='staffingHomeTile';tile.type='button';
      tile.innerHTML='<div><div class="tile-icon">👥</div><h3>Staffing</h3><p>See who is working, who opens and plan future days.</p></div><span class="tile-status">Open staffing calendar</span>';
      tile.addEventListener('click',()=>{window.location.href='staffing.html'});
      bookingTile?.after(tile);
    }

    let summary=document.getElementById('staffingToday');
    if(!summary){
      summary=document.createElement('section');summary.id='staffingToday';summary.className='staffing-today';summary.tabIndex=0;summary.setAttribute('role','button');
      summary.innerHTML='<div class="staffing-today-head"><h3>Today’s staffing</h3><span class="staffing-today-date" id="staffingTodayDate"></span></div><div class="staffing-today-body" id="staffingTodayBody">Loading today’s team…</div>';
      const hero=document.querySelector('#homeView .home-hero');hero?.after(summary);
      const open=()=>{window.location.href='staffing.html'};summary.addEventListener('click',open);summary.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
    }

    const now=new Date();
    const date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const dateEl=document.getElementById('staffingTodayDate');
    if(dateEl)dateEl.textContent=new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'}).format(now);
    const body=document.getElementById('staffingTodayBody');
    if(!body||!window.supabase||!window.WOODS_CONFIG)return;
    const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const client=window.supabase.createClient(window.WOODS_CONFIG.supabaseUrl,window.WOODS_CONFIG.supabaseAnonKey);
    (async()=>{
      const session=await client.auth.getSession();
      if(!session.data.session){body.textContent='Sign in to see today’s staffing.';return}
      const q=await client.from('shop_staffing').select('is_closed,staff,opener,notes').eq('shift_date',date).maybeSingle();
      if(q.error){body.textContent='Today’s staffing could not be loaded.';return}
      const row=q.data;
      if(!row){body.textContent='No staffing has been saved for today yet.';return}
      if(row.is_closed){summary.classList.add('closed');body.innerHTML='<strong>Shop closed today</strong>';return}
      const selected=Object.entries(row.staff||{}).filter(([,on])=>!!on).map(([name])=>name);
      const opener=row.opener?` <strong>Opens:</strong> ${esc(row.opener)}.`:'';
      body.innerHTML=selected.length?`<strong>In today:</strong> ${selected.map(esc).join(', ')}.${opener}`:`No team members are marked in today.${opener}`;
    })();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
