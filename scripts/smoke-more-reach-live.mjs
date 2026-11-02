const base='https://www.dalelah.co';
const expected='8b27515ef163b00ceec9a957968e7239a8a0318d';
const report={base,at:new Date().toISOString()};
const options={signal:AbortSignal.timeout(20000)};
const started=Date.now();
try{
 const health=await fetch(base+'/healthz',options).then(r=>r.json());
 report.liveCommit=health.renderGitCommit;
 if(report.liveCommit!==expected)throw Error('unexpected-production-commit');
 const assets=await Promise.all([
  fetch(base+'/source-search-links.js',options),
  fetch(base+'/market-ui.js',options)
 ]);
 const contents=await Promise.all(assets.map(r=>r.text()));
 report.assetsPresent=assets.every(r=>r.ok)&&contents[0].includes('externalSearchLinks')&&contents[1].includes('sourceSearchLinks');
 if(!report.assetsPresent)throw Error('source-link-assets-unavailable');
 const startSearch=Date.now();
 const response=await fetch(base+'/api/search',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({query:'Toyota Corolla 2013',condition:'used',filters:{}}),signal:AbortSignal.timeout(20000)});
 const data=await response.json();
 report.firstResponseMs=Date.now()-startSearch;
 report.resultCount=data.listings?.length??null;
 report.links=(data.externalSearchOptions||[]).map(s=>({source:s.name,domain:new URL(s.url).hostname}));
 report.linksValid=report.links.length===2&&
  report.links.some(x=>x.source==='Haraj'&&x.domain==='haraj.com.sa')&&
  report.links.some(x=>x.source==='OpenSooq'&&x.domain==='sa.opensooq.com');
 report.ok=response.ok&&report.assetsPresent&&report.linksValid;
 if(!report.ok)throw Error('result-source-links-unavailable');
}catch(error){report.ok=false;report.error=String(error?.message||error)}
report.elapsedMs=Date.now()-started;
console.log('MORE_REACH_RELEASE_SMOKE '+JSON.stringify(report));
if(!report.ok)process.exitCode=1;
