(()=>{
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  function mergeByUrl(a=[],b=[]){
    const m=new Map();
    for(const c of [...a,...b]){
      if(!c?.url)continue;
      const k=String(c.url).replace(/\/$/,'');
      const old=m.get(k);
      if(!old){m.set(k,c);continue}
      const useNewPrice=c.priceVerified&&!old.priceVerified;
      const useNewImage=c.imageVerified&&!old.imageVerified;
      m.set(k,{...old,...c,
        price:useNewPrice?c.price:(old.price??c.price??null),
        priceVerified:Boolean(old.priceVerified||c.priceVerified),
        priceSource:useNewPrice?c.priceSource:(old.priceSource||c.priceSource||null),
        image:useNewImage?c.image:(old.image||c.image||null),
        displayImage:useNewImage?c.displayImage:(old.displayImage||c.displayImage||null),
        imageVerified:Boolean(old.imageVerified||c.imageVerified),
        imageSource:useNewImage?c.imageSource:(old.imageSource||c.imageSource||null)
      });
    }
    return [...m.values()].sort((x,y)=>(y.score||0)-(x.score||0));
  }
  async function progress(searchId,seq){
    let lastCount=listings.length,failures=0;
    for(let i=0;i<90;i++){
      if(seq!==searchSeq)return;
      await delay(i<10?1000:1500);
      if(seq!==searchSeq)return;
      try{
        const r=await fetch(`/api/search/progress/${encodeURIComponent(searchId)}`,{signal:AbortSignal.timeout(9000)});
        if(!r.ok){if(r.status===404)return;throw new Error(`HTTP ${r.status}`)}
        const d=await r.json(); failures=0;
        listings=mergeByUrl(listings,d.listings||[]);
        if(listings.length!==lastCount){lastCount=listings.length;render();}
        renderStats(d,!d.complete);
        answer.textContent=d.answer||(d.complete?`Market scan complete: ${listings.length} verified listings.`:`${listings.length} verified listings found so far. Still scanning connected Saudi sources…`);
        sub.textContent=d.complete?`${listings.length} verified ${condition} car${listings.length===1?'':'s'} found across accessible connected sources.`:`${listings.length} verified cars found so far — the Saudi-market scan is still running.`;
        if(d.complete){searchBox.classList.remove('loading');askBtn.textContent='Ask Delilah ✦';return;}
      }catch(e){
        failures++;
        if(failures>=4){answer.textContent=`Showing ${listings.length} verified results. The background scan paused before every connected source finished.`;renderStats({},false);return;}
      }
    }
    if(seq===searchSeq){answer.textContent=`Showing ${listings.length} verified results. The market scan reached its time limit.`;renderStats({},false);}
  }

  window.go=async function(){
    const query=q.value.trim();if(!query)return;
    const seq=++searchSeq;
    fastController?.abort();fullController?.abort();
    fastController=new AbortController();fullController=new AbortController();
    visibleCount=18;listings=[];
    searchBox.classList.add('loading');askBtn.textContent='Finding cars…';answerBox.classList.add('show');
    answer.textContent=`Finding the first verified ${condition} cars…`;stats.innerHTML='';sub.textContent='Searching the fastest live inventory first…';
    showSkeletons();
    const payload={query,condition,filters:getFilters()};let fastShown=false;
    try{
      const timer=setTimeout(()=>fastController.abort(),9000);let fast;
      try{fast=await postSearch({...payload,phase:'fast'},fastController.signal)}finally{clearTimeout(timer)}
      if(seq!==searchSeq)return;
      if((fast.listings||[]).length){
        listings=mergeByUrl([],fast.listings);fastShown=true;
        answer.textContent=`Found ${listings.length} cars quickly. I’m scanning the rest of the Saudi market now…`;
        sub.textContent=`First ${listings.length} verified ${condition} cars are ready${fast.elapsedMs?` in ${(fast.elapsedMs/1000).toFixed(1)}s`:''}. More can still arrive.`;
        renderStats(fast,true);render();searchBox.classList.remove('loading');askBtn.textContent='Ask Delilah ✦';
      }else{
        answer.textContent='Fast inventory checked. Searching the wider Saudi market…';sub.textContent='Scanning connected marketplaces and dealers…';showSkeletons(3);
      }
    }catch(e){
      if(seq!==searchSeq)return;
      if(e.name!=='AbortError'){answer.textContent='Fast lane had no result. Searching the full Saudi market…';sub.textContent='Scanning connected marketplaces and dealers…'}
      showSkeletons(3);
    }
    try{
      const full=await postSearch({...payload,phase:'full'},fullController.signal);
      if(seq!==searchSeq)return;
      listings=mergeByUrl(listings,full.listings||[]);visibleCount=18;
      answer.textContent=full.answer||'Search running.';
      sub.textContent=full.complete?`${listings.length} verified ${condition} car${listings.length===1?'':'s'} found across accessible connected sources.`:`${listings.length} verified cars found so far — scanning more connected Saudi sources…`;
      empty.textContent=listings.length?'':`No verified ${condition} listings found yet for this search.`;
      renderStats(full,!full.complete);render();
      searchBox.classList.remove('loading');askBtn.textContent='Ask Delilah ✦';
      if(full.searchId&&!full.complete)progress(full.searchId,seq).catch(()=>{});
    }catch(e){
      if(seq!==searchSeq||e.name==='AbortError')return;
      if(!fastShown){listings=[];render();answer.innerHTML=`<span class="err">${esc(e.message)}</span>`;sub.textContent='Search needs attention.';empty.textContent='Search could not run.'}
      else{answer.textContent=`Showing the ${listings.length} fast results. The wider scan could not start this time.`;renderStats({},false)}
    }finally{
      if(seq===searchSeq){searchBox.classList.remove('loading');askBtn.textContent='Ask Delilah ✦'}
    }
  };
})();
