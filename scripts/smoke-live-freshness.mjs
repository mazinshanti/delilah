const root=(process.env.DALELAH_SITE||'https://www.dalelah.co').replace(/\/$/,'');
const expected=process.env.DALELAH_EXPECTED_SHA||'bd78f912daf84c65b95ee1a18b504141f7accbab';
const report={site:root,at:new Date().toISOString(),checks:[]};
async function get(path){
 const started=Date.now();
 const response=await fetch(root+path,{signal:AbortSignal.timeout(15000)});
 return {response,text:await response.text(),ms:Date.now()-started};
}
function check(name,okay,info={}){report.checks.push({name,pass:Boolean(okay),...info});}
try{
 const health=await get('/healthz');
 const h=JSON.parse(health.text);
 check('deployed_frontend',health.response.ok&&h.ok===true&&h.renderGitCommit===expected,
  {sha:h.renderGitCommit,ms:health.ms});
 const ui=await get('/market-ui.js?v=condition2');
 check('listing_observation_copy',ui.response.ok&&ui.text.includes('Last observed:')&&
   ui.text.includes('Not recently checked; price and availability may have changed.')&&
   ui.text.includes('listingObservation'),{ms:ui.ms});
 const copy=await get('/experience-model.js?v=valuation1');
 check('no_unsupported_daily_claim',copy.response.ok&&
  copy.text.includes('Listing dates shown')&&!copy.text.includes('Updated daily')&&
  !copy.text.includes('Featured cars available now'),{ms:copy.ms});
 const coverage=await get('/api/inventory/coverage');
 const cov=JSON.parse(coverage.text);
 check('honest_stale_snapshot',coverage.response.ok&&cov.marketCoveragePct===null&&
   cov.marketExhaustive===false&&cov.indexedUrlCount>=1000,
   {indexedUrlCount:cov.indexedUrlCount,freshUrlCount:cov.freshUrlCount,sources:cov.observedSources,ms:coverage.ms});
 const started=Date.now();
 const response=await fetch(root+'/api/search',{method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({query:'Toyota Camry',condition:'used',filters:{}}),
  signal:AbortSignal.timeout(25000)});
 const search=await response.json();
 const f=search.freshnessSummary||{};
 check('search_freshness_counts',response.ok&&Array.isArray(search.listings)&&
  search.listings.length>0&&Number.isInteger(f.recent)&&Number.isInteger(f.stale)&&
  Number.isInteger(f.unknown)&&
  f.recent+f.stale+f.unknown===search.listings.length&&
  f.freshnessIsAvailabilityProof===false,
  {listings:search.listings?.length||0,freshness:f,ms:Date.now()-started});
}catch(e){check('public_site_access',false,{error:String(e.message||e).slice(0,200)})}
report.pass=report.checks.every(c=>c.pass);
console.log('FRESHNESS_RELEASE_SMOKE '+JSON.stringify(report));
if(!report.pass)process.exitCode=1;
