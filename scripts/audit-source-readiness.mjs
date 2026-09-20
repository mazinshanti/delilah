// Read-only readiness evidence. Never equates a reachable page with accepted stock.
import {SAUDI_MARKET_SEARCH_TARGETS} from '../lib/saudi-market-search-plan.js';
import {robotsPolicy} from '../lib/robots-policy.js';
import {curlFetch} from './support/curl-fetch.mjs';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const output=process.argv[2]||'/tmp/dalelah-source-readiness';await mkdir(output,{recursive:true});
const selectedIds=new Set(process.argv.slice(3));
const targets=SAUDI_MARKET_SEARCH_TARGETS.filter(t=>!selectedIds.size||selectedIds.has(t.id));
if(selectedIds.size&&targets.length!==selectedIds.size)throw Error('unknown-source-id');
const groups=new Map();for(const target of targets){const origin=new URL(target.url).origin;if(!groups.has(origin))groups.set(origin,[]);groups.get(origin).push(target);}
const report={startedAt:new Date().toISOString(),mode:'public-source-readiness',sources:[],acceptedVehicles:0,coverageComplete:false};
let saveQueue=Promise.resolve();
async function record(row){report.sources.push(row);console.log(JSON.stringify(row));const copy=JSON.stringify(report,null,2);saveQueue=saveQueue.then(async()=>{await writeFile(output+'/report.json.tmp',copy);await rename(output+'/report.json.tmp',output+'/report.json');});await saveQueue;}
let cursor=0;const jobs=[...groups.entries()];
await Promise.all(Array.from({length:4},async()=>{while(cursor<jobs.length){
 const [origin,targets]=jobs[cursor++];let robots=null,robotStatus=null;
 try{const r=await curlFetch(origin+'/robots.txt',{headers:{'User-Agent':'Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)'}});robotStatus=r.status;if(r.ok)robots=await r.text();else if(r.status===404)robots='';}catch{robotStatus='fetch-failed';}
 for(const t of targets){const start=Date.now();let row={id:t.id,name:t.name,url:t.url,registryStatus:t.status,robotsStatus:robotStatus,checkedAt:new Date().toISOString(),acceptedVehicles:0};
 if(t.status==='authorization-required'||t.id==='otm'){await record({...row,status:'authorization-pending',reason:t.evidence});continue;}
 if(robots===null){await record({...row,status:'robots-unavailable'});continue;}
 const policy=robotsPolicy(robots,t.url);if(!policy.allowed||policy.delayMs>30000){await record({...row,status:policy.allowed?'source-delay-exceeds-budget':'robots-disallowed'});continue;}
 await new Promise(r=>setTimeout(r,policy.delayMs));
 try{const response=await curlFetch(new URL(t.url).href,{headers:{'User-Agent':'Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)'}});row.httpStatus=response.status;
 if(response.status>=300&&response.status<400){row.status='redirect-review';row.location=response.headers.get('location');}
 else if(!response.ok)row.status='HTTP '+response.status;
 else{const html=await response.text();await writeFile(output+'/'+t.id+'.html',html);row.bytes=Buffer.byteLength(html);row.sha256=createHash('sha256').update(html).digest('hex');row.title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g,' ').slice(0,160)||null;row.status=html.trim()?'page-readable':'empty-response';row.jsonLdBlocks=[...html.matchAll(/application\/ld\+json/gi)].length;row.observedLinks=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].length;}
 }catch{row.status='fetch-failed';}
 row.elapsedMs=Date.now()-start;await record(row);
 }
}}));
report.completedAt=new Date().toISOString();report.totalTargets=targets.length;await saveQueue;await writeFile(output+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({stage:'complete',targets:report.sources.length,reportPath:output+'/report.json'}));
