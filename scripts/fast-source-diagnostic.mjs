import assert from 'node:assert/strict';

const targets=[['production','https://delilah-pm5f.onrender.com'],['candidate','https://dalelah-brand-outer-hotfix.onrender.com']];
const cases=[['Toyota Corolla 2013','used',2013],['Toyota Camry 2018','used',2018],['Nissan Patrol 2020','used',2020],['Jeep Wrangler 2021','used',2021],['Chevrolet Tahoe 2021','used',2021]];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function summarize(listings=[]){
  const haraj=(Array.isArray(listings)?listings:[]).filter(x=>x.source==='Haraj');
  const priced=haraj.filter(x=>x.priceVerified===true&&Number.isFinite(Number(x.price)));
  const suspicious=priced.filter(x=>Number(x.price)<5000||Number(x.price)>5_000_000);
  const sources=priced.reduce((a,x)=>(a[x.priceSource||'unknown']=(a[x.priceSource||'unknown']||0)+1,a),{});
  return{haraj:haraj.length,priced:priced.length,fill:haraj.length?Math.round(priced.length/haraj.length*100):0,suspicious:suspicious.length,sources,samples:priced.slice(0,6).map(x=>({title:x.title,price:x.price,priceSource:x.priceSource,evidence:x.priceEvidence||null,url:x.url}))};
}

let candidatePriced=0,candidateHaraj=0;
for(const [query,condition] of cases){
  for(const [target,base] of targets){
    const started=Date.now();
    const r=await fetch(base+'/api/search',{method:'POST',headers:{'content-type':'application/json','cache-control':'no-cache'},body:JSON.stringify({query,condition,filters:{}}),signal:AbortSignal.timeout(25_000)});
    assert.ok(r.ok,`${target} ${query} HTTP ${r.status}`);
    let d=await r.json();
    if(target==='candidate'&&d.searchId){
      for(let i=0;i<3&&d.searchId;i++){
        await sleep(350);
        const p=await fetch(`${base}/api/search/progress/${encodeURIComponent(d.searchId)}`,{signal:AbortSignal.timeout(25_000)});
        if(!p.ok)break;
        d=await p.json();
      }
    }
    const s=summarize(d.listings);
    console.log('HARAJ_PRICE_COMPARE '+JSON.stringify({query,target,ms:Date.now()-started,priceMatrix:d.harajPriceMatrix===true,...s}));
    assert.equal(s.suspicious,0,`${target} ${query}: suspicious verified price`);
    if(target==='candidate'){
      assert.equal(d.harajPriceMatrix,true,`${query}: candidate price matrix flag missing`);
      candidatePriced+=s.priced;candidateHaraj+=s.haraj;
    }
  }
}
assert.ok(candidateHaraj>0,'candidate returned no Haraj cars');
assert.ok(candidatePriced>0,'candidate imported zero verified Haraj prices');
console.log('HARAJ_PRICE_CANDIDATE_SUMMARY '+JSON.stringify({haraj:candidateHaraj,priced:candidatePriced,fill:Math.round(candidatePriced/candidateHaraj*100)}));
