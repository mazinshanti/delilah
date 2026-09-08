(() => {
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

  async function poll(searchId, token){
    for(let i=0;i<5;i++){
      await new Promise(r=>setTimeout(r,1400));
      if(window.__dalelahSearchToken!==token)return;
      try{
        const r=await fetch(`/api/search/progress/${encodeURIComponent(searchId)}`); if(!r.ok)return;
        const d=await r.json();
        if(window.__dalelahSearchToken!==token)return;
        listings=d.listings||[];
        const sub=document.getElementById('sub'), ans=document.getElementById('answerText');
        if(sub)sub.textContent=`${listings.length} ${condition} cars across ${Object.keys(d.counts||{}).length} sources · ${d.indexed||0} indexed`;
        if(ans)ans.textContent=d.done?`${listings.length} matching listings found. Market scan complete.`:`${listings.length} matching listings found. More sources are still scanning…`;
        render();
        if(d.done){loadSources();return}
      }catch{return}
    }
  }

  async function runV14(){
    const query=document.getElementById('q').value.trim(); if(!query)return;
    const token=Date.now(); window.__dalelahSearchToken=token;
    const searchBox=document.getElementById('search'), ask=document.getElementById('ask'), answer=document.getElementById('answer'), answerText=document.getElementById('answerText'), sub=document.getElementById('sub');
    searchBox?.classList.add('loading'); if(ask)ask.textContent='Searching…'; answer?.classList.add('show');
    if(answerText)answerText.textContent='Checking Dalelah’s live index…'; if(sub)sub.textContent='Loading the fastest matches first…';
    try{
      const r=await fetch('/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition,filters:filters(),phase:'fast'})});
      const d=await r.json(); if(!r.ok)throw new Error(d.error||'Search failed');
      if(window.__dalelahSearchToken!==token)return;
      listings=d.listings||[];
      if(answerText)answerText.textContent=d.partial?`${listings.length} matches now. Dalelah is still scanning the market in the background…`:`${listings.length} matching listings found.`;
      if(sub)sub.textContent=`${listings.length} ${condition} cars across ${Object.keys(d.counts||{}).length} sources · ${d.indexed||0} indexed`;
      render();
      if(d.searchId&&d.partial)poll(d.searchId,token);
      loadSources();
    }catch(e){
      if(answerText)answerText.textContent=e.message; listings=[]; render();
    }finally{
      searchBox?.classList.remove('loading'); if(ask)ask.textContent='Ask Dalelah ✦';
    }
  }

  window.run=runV14;
  const ask=document.getElementById('ask'), q=document.getElementById('q'), browseGo=document.getElementById('browseGo');
  if(ask)ask.onclick=runV14;
  if(q)q.onkeydown=e=>{if(e.key==='Enter')runV14()};
  if(browseGo)browseGo.onclick=()=>{const query=[selectedBrand,document.getElementById('model').value,document.getElementById('category').value].filter(Boolean).join(' ');document.getElementById('q').value=query;runV14()};
  loadSources();
  setInterval(loadSources,30000);
})();