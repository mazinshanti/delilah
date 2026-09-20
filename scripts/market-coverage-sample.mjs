// Resume a bounded exact-model source sample. Never claims whole-market recall.
import fs from 'node:fs/promises';
import {catalogIntent} from '../public/catalog.js';
import {needsAI} from '../public/search-route.js';
import {marketDiscoverySeeds} from '../lib/market-discovery-seeds.js';
import {runAdaptiveMarketDiscovery,createMarketDetailReader,marketListingKey,marketCandidate,AI_MARKET_SOURCES} from '../lib/ai-market-discovery-trial.js';
const [query,output,...flags]=process.argv.slice(2);
if(flags.some(f=>!['--resume','--curl'].includes(f)&&!/^--details=\d+$/.test(f)))throw Error('Unknown sample option');
const detailBudget=Number(flags.find(f=>f.startsWith('--details='))?.split('=')[1]||6);
if(!Number.isInteger(detailBudget)||detailBudget<1||detailBudget>60)throw Error('Detail batch must be 1–60');
if(!query||!output||query.length>180||!catalogIntent(query).model||needsAI(query))throw Error('Use an exact make/model query and report path; natural-language searches use the existing intent engine.');
const body={query,condition:'all',filters:{}},intent={excludedMakes:[]};
let prior=null;
if(flags.includes('--resume')){
 prior=JSON.parse(await fs.readFile(output,'utf8'));
 if(prior.mode!=='resumable-exact-model-sample'||prior.version!==1||JSON.stringify(prior.body)!==JSON.stringify(body))throw Error('resume-query-mismatch');
}
const transport=flags.includes('--curl')?(await import('./support/curl-fetch.mjs')).curlFetch:fetch;
const started=performance.now();
const retryable=r=>/^(?:source-fetch-failed|source-paused|empty-source-response|HTTP (?:408|429|5\d\d))$/.test(r.status);
// Once there is enough known work, verify it before spending time on more pages.
// Deferred page URLs remain in the checkpoint and resume when the queue runs low.
const pageBudget=(prior?.pendingUrls?.length||0)>=detailBudget?0:3;
const result=await runAdaptiveMarketDiscovery(body,intent,{
 maxRounds:1,maxDetails:detailBudget,maxPages:pageBudget,
 previouslyCheckedUrls:(prior?.results||[]).filter(r=>!retryable(r)).map(r=>r.url),
 previouslyReadPages:(prior?.discoveryPages||[]).filter(r=>!retryable(r)).map(p=>p.url),
 readDetail:createMarketDetailReader({fetchImpl:transport}),
 discover:async()=>({status:'completed',webSearchCalls:0,urls:[...(prior?.pendingUrls||[]),...(prior?.results||[]).filter(retryable).map(r=>r.url)],discoveryPages:prior?[...prior.pendingDiscoveryPages,...prior.discoveryPages.filter(retryable).map(p=>p.url)]:marketDiscoverySeeds(query)}),
 onProgress:e=>{if(e.stage==='discovery-page'||e.listing)console.log(JSON.stringify({stage:e.stage||'listing',source:e.source,status:e.status,detailLinks:e.detailLinks,title:e.listing?.title}));}
});
const unique=(rows,key)=>[...new Map(rows.map(r=>[key(r),r])).values()];
const results=unique([...(prior?.results||[]),...result.results],r=>marketListingKey(r.url));
const discoveryPages=unique([...(prior?.discoveryPages||[]),...result.discoveryPages],r=>r.url);
const listings=unique([...(prior?.listings||[]),...result.listings],r=>marketListingKey(r.url));
const pendingUrls=result.pendingUrls,pendingDiscoveryPages=result.pendingDiscoveryPages;
const report={mode:'resumable-exact-model-sample',version:1,body,startedAt:prior?.startedAt||new Date().toISOString(),updatedAt:new Date().toISOString(),coverageComplete:false,marketCoveragePercent:null,accepted: listings.length,checked:results.length,pending:pendingUrls.length,results,discoveryPages,listings,pendingUrls,pendingDiscoveryPages,
 runs:[...(prior?.runs||[]),{detailBudget,pageBudget,newChecked:result.checked,newAccepted:result.accepted,firstResultMs:result.firstResultMs,totalMs:Math.round(performance.now()-started),stopReason:result.stopReason}],
 sourceStats:AI_MARKET_SOURCES.map(s=>{const checked=results.filter(r=>r.source===s.name),accepted=checked.filter(r=>r.status==='accepted');const queued=pendingUrls.filter(u=>marketCandidate(u)?.source.id===s.id);const known=new Set([...checked.map(r=>r.url),...queued].map(marketListingKey)).size;return {source:s.name,knownCandidateCount:known,pending:queued.length,checked:checked.length,accepted:accepted.length,checkedShareOfKnownCandidates:known?checked.length/known:null,acceptanceRate:checked.length?accepted.length/checked.length:null,rejectionReasons:checked.filter(r=>r.status!=='accepted').reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),marketCoveragePercent:null};})};
await fs.writeFile(output+'.tmp',JSON.stringify(report,null,2));await fs.rename(output+'.tmp',output);
console.log(JSON.stringify({reportPath:output,...report.runs.at(-1),sessionChecked:report.checked,sessionAccepted:report.accepted,pending:report.pending,pendingPages:pendingDiscoveryPages.length,marketCoveragePercent:null}));
