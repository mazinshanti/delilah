import assert from 'node:assert/strict';

const targets=[['production','https://delilah-pm5f.onrender.com'],['candidate','https://dalelah-brand-outer-hotfix.onrender.com']];
const cases=[['Toyota Corolla 2013','used'],['Toyota Camry 2018','used'],['Nissan Patrol 2020','used'],['Jeep Wrangler 2021','used'],['Chevrolet Tahoe 2021','used']];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const JUNK=/(?:قطع\s*غيار|مكين[هة]|محرك|ايرباق|ارباق|طبلون|كمبروسر|دينمو|رديتر|صدام|شبك|شمعة|شمعات|انوار|أنوار|رفرف|كبوت|جنوط|كفرات|فلتر|طرمب[هة]|حساس|اصطب|اسطب|كشاف|تشليح|عداد.{0,60}(?:اصلي|أصلي|وكاله|وكالة|يركب|تركيب))/i;

function summarize(listings=[]){
  const haraj=(Array.isArray(listings)?listings:[]).filter(x=>x.source==='Haraj');
  const priced=haraj.filter(x=>x.priceVerified===true&&Number.isFinite(Number(x.price)));
  const suspicious=priced.filter(x=>Number(x.price)<5000||Number(x.price)>5_000_000);
  const junk=haraj.filter(x=>JUNK.test(`${x.title||''} ${x.snippet||''}`));
  const sources=priced.reduce((a,x)=>(a[x.priceSource||'unknown']=(a[x.priceSource||'unknown']||0)+1,a),{});
  return{haraj:haraj.length,priced:priced.length,fill:haraj.length?Math.round(priced.length/haraj.length*100):0,suspicious:suspicious.length,junk:junk.length,sources,samples:priced.slice(0,6).map(x=>({title:x.title,price:x.price,priceSource:x.priceSource,evidence:x.priceEvidence||null,discovery:x.priceDiscovery||null,url:x.url}))};
}

let candidateInitialPriced=0,candidateFinalPriced=0,candidateFinalHaraj=0,totalEnriched=0;
for(const [query,condition] of cases){
  for(const [target,base] of targets){
    const started=Date.now();
    const r=await fetch(base+'/api/search',{method:'POST',headers:{'content-type':'application/json','cache-control':'no-cache'},body:JSON.stringify({query,condition,filters:{}}),signal:AbortSignal.timeout(25_000)});
    assert.ok(r.ok,`${target} ${query} HTTP ${r.status}`);
    let d=await r.json();
    const initial=summarize(d.listings);
    let polls=0;
    if(target==='candidate'&&d.searchId){
      for(let i=0;i<8&&d.searchId;i++){
        await sleep(i<3?350:700);
        const p=await fetch(`${base}/api/search/progress/${encodeURIComponent(d.searchId)}`,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(25_000)});
        if(!p.ok)break;
        d=await p.json();polls++;
        if(d.harajPriceEnrichmentComplete===true&&i>=2)break;
      }
    }
    const final=summarize(d.listings);
    console.log('HARAJ_PRICE_COMPARE '+JSON.stringify({query,target,ms:Date.now()-started,polls,priceMatrix:d.harajPriceMatrix===true,detailEnrichment:d.harajDetailPriceEnrichment===true,enrichmentComplete:d.harajPriceEnrichmentComplete??null,enriched:d.harajDetailPricesEnriched??0,attempted:d.harajDetailPricesAttempted??0,initial,final}));
    assert.equal(final.suspicious,0,`${target} ${query}: suspicious verified price`);
    assert.equal(final.junk,0,`${target} ${query}: junk Haraj listing leaked`);
    if(target==='candidate'){
      assert.equal(d.harajPriceMatrix,true,`${query}: candidate price matrix flag missing`);
      assert.equal(d.harajDetailPriceEnrichment,true,`${query}: detail enrichment flag missing`);
      assert.ok(final.priced>=initial.priced,`${query}: verified price count regressed during enrichment`);
      candidateInitialPriced+=initial.priced;candidateFinalPriced+=final.priced;candidateFinalHaraj+=final.haraj;totalEnriched+=Number(d.harajDetailPricesEnriched||0);
    }
  }
}
assert.ok(candidateFinalHaraj>0,'candidate returned no Haraj cars');
assert.ok(candidateFinalPriced>0,'candidate imported zero verified Haraj prices');
console.log('HARAJ_PRICE_CANDIDATE_SUMMARY '+JSON.stringify({haraj:candidateFinalHaraj,initialPriced:candidateInitialPriced,finalPriced:candidateFinalPriced,finalFill:Math.round(candidateFinalPriced/candidateFinalHaraj*100),detailPricesEnriched:totalEnriched}));
