import './server-v1.4-ai.js';

const port=Number(process.env.PORT||3000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const base=`http://127.0.0.1:${port}`;
const partRe=/spare part|parts|accessor|body kit|bumper|bonnet|hood|fender|headlight|tail light|taillight|grille|grill|door|mirror|windshield|engine|gearbox|transmission|differential|axle|suspension|radiator|compressor|alternator|exhaust|turbo|injector|spark plug|brake pad|brake disc|spoiler|roof rack|floor mat|seat cover|wheel rim|alloy rim|tyre|tire|قطع غيار|تشليح|اكسسوارات|إكسسوارات|صدام|كبوت|رفرف|شمعة|شمعات|كشاف|كشافات|باب|مراية|مرايات|زجاج|مكينة|مكينه|ماكينة|قير|دفرنس|اكسل|رديتر|راديتر|كمبروسر|دينمو|سلف|شكمان|دبة|دبه|تيربو|بخاخ|بواجي|فحمات|هوبات|جنوط|جنط|كفرات|كفر|سبويلر|فرش|مساعدات/i;

async function get(path){
  const t=Date.now(); const r=await fetch(`${base}${path}`,{signal:AbortSignal.timeout(15000)}); const d=await r.json();
  return {status:r.status,ms:Date.now()-t,d};
}
async function search(name,query,condition='used',filters={}){
  const t=Date.now();
  try{
    const r=await fetch(`${base}/api/search`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,condition,filters}),signal:AbortSignal.timeout(25000)});
    const d=await r.json();
    const listings=Array.isArray(d.listings)?d.listings:[];
    const partHits=listings.filter(x=>partRe.test(`${x.title||''} ${(()=>{try{return decodeURIComponent(new URL(x.url).pathname)}catch{return''}})()}`));
    const result={name,query,status:r.status,ms:Date.now()-t,count:listings.length,counts:d.counts||{},haraj:(d.counts||{}).Haraj||0,aiEnabled:d.aiEnabled,aiUsed:Boolean(d.intent?.ai),aiError:d.intent?.aiError||null,intent:d.intent||null,vehicleOnly:d.vehicleOnly,retrievalQueries:d.retrievalQueries||[],partHits:partHits.length,sample:listings.slice(0,5).map(x=>({source:x.source,title:x.title,year:x.year,price:x.price,city:x.city,matchTier:x.matchTier,missingData:x.missingData,url:x.url}))};
    console.log('V14_AI_QA',JSON.stringify(result));
    return result;
  }catch(e){const result={name,query,error:e?.message||String(e),ms:Date.now()-t};console.log('V14_AI_QA',JSON.stringify(result));return result;}
}

await sleep(15000);
try{
  const [health,stats,sources]=await Promise.all([get('/api/health'),get('/api/catalog/stats'),get('/api/sources')]);
  console.log('V14_AI_QA_STATE',JSON.stringify({health:health.d,healthMs:health.ms,indexed:stats.d.indexed,counts:stats.d.counts,sources:(sources.d.sources||[]).map(s=>({name:s.name,status:s.status,indexed:s.indexed,lastBatch:s.lastBatch||0,error:s.lastError||null}))}));
}catch(e){console.log('V14_AI_QA_STATE_ERROR',e?.message||String(e));}

const tests=[
  ['arabic_budget_family','افكر اشتري سيارة ليه و لزوجتي و عندنا طفلين معاية ٣٠٠٠٠ ريال و اعيش بالرياض','used',{}],
  ['broad_toyota','Toyota','used',{}],
  ['parts_arabic','صدام كامري','used',{}]
];
for(const [n,q,c,f] of tests){await search(n,q,c,f);await sleep(500);}

await sleep(12000);
try{
  const stats=await get('/api/catalog/stats');
  console.log('V14_AI_QA_FINAL',JSON.stringify({indexed:stats.d.indexed,counts:stats.d.counts,withImages:stats.d.withImages,withPrices:stats.d.withPrices,verified:stats.d.verified}));
}catch(e){console.log('V14_AI_QA_FINAL_ERROR',e?.message||String(e));}
