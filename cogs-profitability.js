// Woods COGS — profitability summary v1
// Click the Fully costed KPI to review, filter and sort active menu items by profitability.
(function(){
  let profitSearch='';
  let profitCategory='all';
  let profitBand='all';
  let profitSort='afterProfit';
  let profitDirection='desc';

  function fullyCostedItems(){
    return data.products.filter(p=>!p.archived && Number(p.price)>0 && !cost(p).incomplete);
  }
  function bandKey(m){return m>=70?'strong':m>=65?'watch':'review'}
  function bandLabel(key){return key==='strong'?'Strong · 70%+':key==='watch'?'Watch · 65–69.9%':'Review · below 65%'}
  function profitRows(){
    const q=profitSearch.trim().toLowerCase();
    const rows=fullyCostedItems().map(p=>{
      const c=cost(p),m=profitability(p,c);
      return {p,c,m,band:bandKey(m.afterMargin)};
    }).filter(x=>(profitCategory==='all'||x.p.category===profitCategory)&&(profitBand==='all'||x.band===profitBand)&&(!q||`${x.p.name} ${x.p.category}`.toLowerCase().includes(q)));
    const getters={
      afterProfit:x=>x.m.afterContribution,
      afterMargin:x=>x.m.afterMargin,
      cogs:x=>x.c.total/x.p.price*100,
      price:x=>x.p.price,
      name:x=>x.p.name.toLowerCase()
    };
    const get=getters[profitSort]||getters.afterProfit,dir=profitDirection==='asc'?1:-1;
    rows.sort((a,b)=>{const av=get(a),bv=get(b);if(typeof av==='string')return av.localeCompare(bv)*dir;return (av-bv)*dir});
    return rows;
  }
  function profitabilitySummary(){
    const all=fullyCostedItems(),rows=profitRows();
    const cats=[...new Set(all.map(p=>p.category))].sort((a,b)=>a.localeCompare(b));
    const strong=all.filter(p=>profitability(p,cost(p)).afterMargin>=70).length;
    const watch=all.filter(p=>{const m=profitability(p,cost(p)).afterMargin;return m>=65&&m<70}).length;
    const review=all.length-strong-watch;
    document.getElementById('panel').innerHTML=`
      <div class="profit-head">
        <div><button onclick="view='categories';render()">← Categories</button><h2>Menu Profitability</h2><p class="note">Fully costed active items · profit and margin after the 11.5% FRS VAT payment.</p></div>
        <div class="profit-mini"><span><b>${all.length}</b> costed</span><span><b>${strong}</b> strong</span><span><b>${watch}</b> watch</span><span><b>${review}</b> review</span></div>
      </div>
      <div class="profit-controls">
        <label>Search<input type="search" placeholder="Item or category…" value="${safe(profitSearch)}" oninput="setProfitFilter('search',this.value)"></label>
        <label>Category<select onchange="setProfitFilter('category',this.value)"><option value="all">All categories</option>${cats.map(c=>`<option value="${safe(c)}" ${profitCategory===c?'selected':''}>${safe(c)}</option>`).join('')}</select></label>
        <label>Margin status<select onchange="setProfitFilter('band',this.value)"><option value="all">All statuses</option><option value="strong" ${profitBand==='strong'?'selected':''}>Strong · 70%+</option><option value="watch" ${profitBand==='watch'?'selected':''}>Watch · 65–69.9%</option><option value="review" ${profitBand==='review'?'selected':''}>Review · below 65%</option></select></label>
        <label>Sort by<select onchange="setProfitFilter('sort',this.value)"><option value="afterProfit" ${profitSort==='afterProfit'?'selected':''}>Profit £ after FRS</option><option value="afterMargin" ${profitSort==='afterMargin'?'selected':''}>Margin % after FRS</option><option value="cogs" ${profitSort==='cogs'?'selected':''}>COGS %</option><option value="price" ${profitSort==='price'?'selected':''}>Selling price</option><option value="name" ${profitSort==='name'?'selected':''}>Item name</option></select></label>
        <label>Order<select onchange="setProfitFilter('direction',this.value)"><option value="desc" ${profitDirection==='desc'?'selected':''}>High → low</option><option value="asc" ${profitDirection==='asc'?'selected':''}>Low → high</option></select></label>
      </div>
      <p class="note profit-count">Showing <strong>${rows.length}</strong> of ${all.length} fully costed items.</p>
      <div class="profit-list">${rows.map((x,i)=>{
        const pct=x.c.total/x.p.price*100;
        return `<article class="profit-card">
          <div class="profit-rank">${i+1}</div>
          <div class="profit-name"><b>${safe(x.p.name)}</b><small>${safe(x.p.category)}</small></div>
          <div><small>Selling price</small><b>${money(x.p.price)}</b></div>
          <div><small>Recipe cost</small><b>${money(x.c.total)}</b></div>
          <div><small>COGS</small><b>${pct.toFixed(1)}%</b></div>
          <div><small>Profit after FRS</small><b>${money(x.m.afterContribution)}</b></div>
          <div><small>Margin after FRS</small>${marginBadge(x.m.afterMargin)}</div>
          <button onclick="openProfitItem('${x.p.id}')">View item</button>
        </article>`
      }).join('')||'<article class="profit-empty">No items match these filters.</article>'}</div>`;
  }

  window.profitabilitySummary=profitabilitySummary;
  window.setProfitFilter=function(key,value){
    if(key==='search')profitSearch=value;else if(key==='category')profitCategory=value;else if(key==='band')profitBand=value;else if(key==='sort')profitSort=value;else if(key==='direction')profitDirection=value;
    profitabilitySummary();
  };
  window.openProfitItem=function(id){const p=data.products.find(x=>x.id===id);if(!p)return;selectedCategory=p.category;view='category';render();setTimeout(()=>{const cards=[...document.querySelectorAll('#panel article')],card=cards.find(a=>a.querySelector('b')?.textContent===p.name);card?.scrollIntoView({behavior:'smooth',block:'center'})},0)};
  window.openProfitability=function(){view='profitability';render()};

  const baseRender=window.render;
  window.render=function(){
    baseRender();
    const kpis=document.querySelectorAll('.kpis > div');
    if(kpis[1]){
      kpis[1].classList.add('kpi-clickable');
      kpis[1].setAttribute('role','button');
      kpis[1].setAttribute('tabindex','0');
      kpis[1].title='Open menu profitability summary';
      kpis[1].onclick=window.openProfitability;
      kpis[1].onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.openProfitability()}};
      const small=kpis[1].querySelector('small');if(small)small.innerHTML='Fully costed <span aria-hidden="true">›</span>';
    }
    if(view==='profitability')profitabilitySummary();
  };

  const style=document.createElement('style');
  style.textContent=`
    .kpi-clickable{cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;border-color:#b9c8ba!important}.kpi-clickable:hover,.kpi-clickable:focus{transform:translateY(-1px);box-shadow:0 5px 16px #263d2c18;outline:2px solid #58705b33}.kpi-clickable small span{font-size:18px;font-weight:800;margin-left:3px}
    .profit-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:14px}.profit-head h2{margin:12px 0 4px}.profit-mini{display:flex;gap:7px;flex-wrap:wrap}.profit-mini span{background:#fff;border:1px solid var(--l);border-radius:10px;padding:8px 10px;font-size:12px}.profit-mini b{font-size:15px;margin-right:3px}
    .profit-controls{display:grid;grid-template-columns:1.35fr repeat(4,1fr);gap:8px;background:#fff;border:1px solid var(--l);border-radius:14px;padding:12px}.profit-controls label{font-size:11px;color:#68766c;font-weight:700}.profit-controls input,.profit-controls select{display:block;width:100%;max-width:none;margin-top:4px}.profit-count{margin:10px 2px}
    .profit-list{display:grid;gap:8px}.profit-card{display:grid;grid-template-columns:38px minmax(160px,1.5fr) repeat(5,minmax(90px,1fr)) auto;gap:10px;align-items:center;background:#fff;border:1px solid var(--l);border-radius:14px;padding:12px}.profit-card small{display:block;color:#68766c;font-size:11px;margin-bottom:3px}.profit-card>div>b{display:block}.profit-rank{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#eef2ed;font-weight:800;color:var(--g)}.profit-name b{font-size:16px}.profit-empty{background:#fff;border:1px solid var(--l);border-radius:14px;padding:20px;text-align:center;color:#68766c}
    @media(max-width:900px){.profit-controls{grid-template-columns:1fr 1fr}.profit-card{grid-template-columns:38px 1fr 1fr 1fr}.profit-card .profit-name{grid-column:2/-1}.profit-card button{grid-column:1/-1}}
    @media(max-width:600px){.profit-head{display:block}.profit-mini{margin-top:10px}.profit-controls{grid-template-columns:1fr 1fr}.profit-controls label:first-child{grid-column:1/-1}.profit-card{grid-template-columns:34px 1fr 1fr;gap:9px}.profit-card .profit-name{grid-column:2/-1}.profit-card>div:nth-of-type(n+3){padding-top:6px;border-top:1px solid #edf0ed}.profit-card button{grid-column:1/-1;width:100%}}
  `;
  document.head.appendChild(style);
})();
