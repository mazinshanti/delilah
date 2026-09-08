(()=>{
  function renderSourceDirectory(){
    const arr=state.sourceDirectory||[];
    $('sourcesBody').innerHTML=arr.length?`<div class="sourcesModal">${arr.map(p=>{const name=p.name||p.source||p.seller||p.id||'Source',status=p.status||p.integrationStatus||p.state||(p.active===true?'active':'candidate'),type=p.type||p.sourceType||p.category||'';return `<div class="sourceCard"><b>${esc(name)}</b><span class="${String(status).toLowerCase().includes('active')?'activeStatus':''}">${esc(status)}${type?' · '+esc(type):''}</span></div>`}).join('')}</div>`:`<div class="empty"><b>Source registry is temporarily unavailable.</b>Your search still shows every source that returned verified cars.</div>`;
  }
  window.openSources=function(){
    renderSourceDirectory();
    openOverlay('sourcesOverlay');
    if(!(state.sourceDirectory||[]).length){
      loadSources().then(renderSourceDirectory).catch(renderSourceDirectory);
    }
  };
})();
