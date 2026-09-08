(() => {
  const escBrain=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const style=document.createElement('style');
  style.textContent=`
    .matchline{display:flex;gap:7px;align-items:center;margin-top:9px;flex-wrap:wrap}
    .matchpill{font-size:9px;font-weight:950;border-radius:999px;padding:6px 8px;background:#1e242a;color:#dfe4e8}
    .matchpill.verified{background:rgba(170,252,139,.13);color:#c8ffb5;border:1px solid rgba(170,252,139,.25)}
    .matchpill.possible{background:rgba(255,220,130,.10);color:#ffe2a0;border:1px solid rgba(255,220,130,.22)}
    .why{font-size:10px;color:#afb5bd;line-height:1.5;margin-top:8px}
    .missing{font-size:9px;color:#d7b77b;margin-top:6px}
  `;
  document.head.appendChild(style);

  function renderBrain(){
    const g=document.getElementById('grid'); if(!g)return;
    if(!listings.length){g.innerHTML='<div class="empty">No current indexed car can be confirmed against those constraints yet. Dalelah will keep refreshing the market.</div>';return}
    g.innerHTML=listings.map(c=>{
      const p=c.presentation||{},title=p.headline||c.title||[c.year,c.brand,c.model].filter(Boolean).join(' ')||'Car listing',img=c.displayImage||c.image;
      const tier=c.matchTier||'possible',score=c.matchScore||c.aiScore||c.score||'—';
      const facts=(p.facts||[c.year?String(c.year):null,c.mileage!=null?`${Number(c.mileage).toLocaleString()} km`:null,c.city||null].filter(Boolean));
      const why=(c.matchReasons||p.why||[]).slice(0,4),missing=(c.missingData||p.missing||[]).slice(0,4);
      return `<article class="card"><div class="photo">${img?`<img src="${escBrain(img)}" alt="${escBrain(title)}">`:'<div class="fallback">CAR</div>'}<span class="chip score">${escBrain(score)}%</span><span class="chip source">${escBrain(c.source||'Source')}</span><span class="chip condition">${escBrain(c.condition||condition)}</span></div><div class="body"><div class="seller">${escBrain(c.seller||c.source||'Seller')}</div><div class="title">${escBrain(title)}</div><div class="matchline"><span class="matchpill ${tier==='verified'?'verified':'possible'}">${tier==='verified'?'✓ Verified match':'◇ Possible match'}</span></div><div class="facts">${facts.map(x=>`<span class="fact">${escBrain(x)}</span>`).join('')}</div><div class="price">${escBrain(p.priceText||(c.price?`${Number(c.price).toLocaleString()} SAR`:'Price on source'))}</div>${why.length?`<div class="why">Why it matches: ${why.map(escBrain).join(' · ')}</div>`:''}${missing.length?`<div class="missing">Needs verification: ${missing.map(escBrain).join(', ')}</div>`:''}<div class="snippet">${escBrain(c.snippet||'Open the original source for listing details.')}</div><button class="open" onclick="window.open('${escBrain(c.url)}','_blank','noopener')">View original listing ↗</button></div></article>`;
    }).join('');
  }
  window.render=renderBrain;

  async function loadSources(){
    try{
      const r=await fetch('/api/sources'); if(!r.ok)return;
      const d=await r.json(), sel=document.getElementById('source'); if(!sel)return;
      const current=sel.value;
      sel.innerHTML='<option value="">All sources</option>'+((d.sources||[]).map(s=>{
        const label=`${s.name}${Number.isFinite(s.indexed)?` · ${s.indexed}`:''}`;
        return `<option value="${String(s.name).replace(/"/g,'&quot;')}">${label}</option>`;
      }).join(''));
      if([...sel.options].some(o=>o.value===current))sel.value=current;
    }catch{}
  }

  function describe(d){
    const v=Number(d.verifiedCount||0),p=Number(d.possibleCount||0),sources=Object.keys(d.counts||{}).length;
    return `${v} verified · ${p} possible · ${sources} source${sources===1?'':'s'}`;
  }
  async function poll(searchId, token){
    for(let i=0;i<5;i++){
      await new Promise(r=>setTimeout(r,1400));
      if(window.__dalelahSearchToken!==token)return;
      try{
        const r=await fetch(`/api/search/progress/${encodeURIComponent(searchId)}`); if(!r.ok)return;
        const d=await r.json(); if(window.__dalelahSearchToken!==token)return;
        listings=d.listings||[];
        const sub=document.getElementById('sub'), ans=document.getElementById('answerText');
        if(sub)sub.textContent=describe(d);
        if(ans)ans.textContent=d.summary||(d.done?'Market scan complete.':'More sources are still refreshing…');
        renderBrain();
        if(d.done){loadSources();return}
      }catch{return}
    }
  }

  async function runV14(){
    const query=document.getElementById('q').value.trim(); if(!query)return;
    const token=Date.now(); window.__dalelahSearchToken=token;
    const searchBox=document.getElementById('search'), ask=document.getElementById('ask'), answer=document.getElementById('answer'), answerText=document.getElementById('answerText'), sub=document.getElementById('sub');
    searchBox?.classList.add('loading'); if(ask)ask.textContent='Searching…'; answer?.classList.add('show');
    if(answerText)answerText.textContent='Understanding your request and checking real Saudi car inventory…'; if(sub)sub.textContent='Loading the strongest matches first…';
    try{
      const r=await fetch('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition,filters:filters(),phase:'fast'})});
      const d=await r.json(); if(!r.ok)throw new Error(d.error||'Search failed');
      if(window.__dalelahSearchToken!==token)return;
      listings=d.listings||[];
      if(answerText)answerText.textContent=d.summary||`${listings.length} matching cars found.`;
      if(sub)sub.textContent=describe(d);
      renderBrain();
      if(d.searchId&&d.partial)poll(d.searchId,token);
      loadSources();
    }catch(e){if(answerText)answerText.textContent=e.message; listings=[]; renderBrain();}
    finally{searchBox?.classList.remove('loading'); if(ask)ask.textContent='Ask Dalelah ✦';}
  }

  window.run=runV14;
  const ask=document.getElementById('ask'), q=document.getElementById('q'), browseGo=document.getElementById('browseGo');
  if(ask)ask.onclick=runV14;
  if(q)q.onkeydown=e=>{if(e.key==='Enter')runV14()};
  if(browseGo)browseGo.onclick=()=>{const query=[selectedBrand,document.getElementById('model').value,document.getElementById('category').value].filter(Boolean).join(' ');document.getElementById('q').value=query;runV14()};
  loadSources(); setInterval(loadSources,30000); renderBrain();
})();