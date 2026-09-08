(()=>{
  let allBrands=true;
  function init(){
    const tabs=document.getElementById('brandTabs32'), model=document.getElementById('modelSelect32'), selected=document.getElementById('selectedBrand32'), goBtn=document.getElementById('browseGo32');
    if(!tabs||!model||!selected||!goBtn)return setTimeout(init,120);
    if(document.getElementById('allBrands35'))return;
    const all=document.createElement('button');
    all.id='allBrands35'; all.className='brandTab32 active'; all.dataset.allBrands='1';
    all.innerHTML='<span class="brandInitial32">ALL</span><span>All brands</span>';
    tabs.prepend(all);
    tabs.querySelectorAll('[data-brand]').forEach(x=>x.classList.remove('active'));
    model.innerHTML='<option value="">All models</option>';
    model.disabled=true; selected.textContent='All brands';
    all.onclick=e=>{e.preventDefault();e.stopPropagation();allBrands=true;tabs.querySelectorAll('.brandTab32').forEach(x=>x.classList.toggle('active',x===all));model.innerHTML='<option value="">All models</option>';model.disabled=true;selected.textContent='All brands'};
    tabs.addEventListener('click',e=>{const b=e.target.closest('[data-brand]');if(!b)return;allBrands=false;all.classList.remove('active');model.disabled=false;},true);
    goBtn.addEventListener('click',e=>{
      if(!allBrands)return;
      e.preventDefault();e.stopImmediatePropagation();
      const cat=document.getElementById('categorySelect32')?.value||'';
      const source=document.getElementById('sourceSelect32')?.value||'';
      if(window.dom?.q)dom.q.value=cat;
      const hidden=document.getElementById('sourceQuickRail28');
      const target=hidden?[...hidden.querySelectorAll('[data-source]')].find(b=>(b.dataset.source||'')===source):null;
      if(target)target.click();else if(typeof go==='function')go();
    },true);
  }
  init();
})();