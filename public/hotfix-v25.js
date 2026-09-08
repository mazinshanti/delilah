(()=>{
  const oldMerge=window.mergeByUrl;
  window.mergeByUrl=function(a=[],b=[]){
    const m=new Map();
    for(const c of [...a,...b]){
      if(!c?.url)continue;
      const k=window.canonical?window.canonical(c.url):String(c.url).replace(/\/$/,'');
      const o=m.get(k);
      if(!o){m.set(k,c);continue}
      const authoritative=Boolean(c.syarahExactVerified||c.harajExactVerified||/^syarah_original_pre_discount_price$/.test(String(c.priceSource||''))||/exact_listing/.test(String(c.priceSource||'')));
      const price=authoritative?c.price:(c.priceVerified&&!o.priceVerified?c.price:(o.price??c.price??null));
      const priceVerified=authoritative?Boolean(c.priceVerified):Boolean(o.priceVerified||c.priceVerified);
      const image=c.imageVerified&&!o.imageVerified?c.image:(o.image||c.image||null);
      const displayImage=c.imageVerified&&!o.imageVerified?c.displayImage:(o.displayImage||c.displayImage||null);
      m.set(k,{...o,...c,price,priceVerified,image,displayImage,imageVerified:Boolean(o.imageVerified||c.imageVerified),score:Math.max(Number(o.score||0),Number(c.score||0))});
    }
    return [...m.values()];
  };
  const oldStats=window.statsFrom;
  if(oldStats)window.statsFrom=function(d={},scanning=false){
    oldStats(d,scanning);
    const u=d.understanding;
    if(!u||!window.dom?.stats)return;
    const bits=[u.brand,u.model,u.minYear?`${u.minYear}+`:null,u.maxPrice?`≤ ${Number(u.maxPrice).toLocaleString()} SAR`:null,u.city].filter(Boolean);
    if(bits.length)window.dom.stats.insertAdjacentHTML('afterbegin',`<span class="stat ok">AI understood: ${bits.map(window.esc||String).join(' · ')}</span>`);
  };
})();
