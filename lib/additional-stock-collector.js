import {gunzipSync} from 'node:zlib';
import {stockMediaValidator} from './additional-stock-media.js';
import {ADDITIONAL_MARKET_SOURCES,stockLinks,stockIdentity,parseAdditionalStock} from './additional-market-sources.js';
import {robotsPolicy} from './robots-policy.js';
import {createStockFrontier,sitemapLocations,allowedStockSitemap} from './stock-frontier.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const limit=(v,d,max)=>Math.max(1,Math.min(max,Math.floor(Number(v)||d)));
// Scheduled ingestion only: detail work never blocks the customer search request.
export async function collectAdditionalStock({fetchImpl=fetch,maxPages=100,maxDetails=2500,maxSitemaps=25,maxDurationMs=30*60000,concurrency=3,wait=sleep,onProgress=()=>{},sources=ADDITIONAL_MARKET_SOURCES,previousDiagnostics=[],previousListings=[],state={},now=Date.now}={}){
 maxPages=limit(maxPages,100,1000);maxDetails=limit(maxDetails,2500,10000);maxSitemaps=limit(maxSitemaps,25,100);concurrency=limit(concurrency,3,3);maxDurationMs=limit(maxDurationMs,30*60000,60*60000);
 const validateMedia=stockMediaValidator(fetchImpl);
 const results=await Promise.all(sources.map(async source=>{
  const listings=[],removedUrls=[],started=now(),deadline=started+maxDurationMs,entry=new URL(source.path,source.url),previous=previousDiagnostics.find(d=>d.source===source.name),saved=state[source.id]||{};
  const frontier=createStockFrontier(source,saved,previousListings,started);
  for(const url of previous?.pendingUrls||[])frontier.add(url);
  const validPage=raw=>{try{const u=new URL(raw);return u.origin===entry.origin&&u.pathname===entry.pathname&&!u.username&&!u.password;}catch{return false;}};
  const continuing=Boolean(saved.pageQueue?.length||saved.sitemapQueue?.length);
  const rescan=!continuing&&(!saved.discoveryAt||started-Date.parse(saved.discoveryAt)>=12*3600000);
  const entryDue=!saved.entryCheckedAt||started-Date.parse(saved.entryCheckedAt)>=12*3600000;
  const queue=[...new Set([...(entryDue?[entry.href]:[]),...(saved.pageQueue||previous?.pendingPages||[]).filter(validPage)])];let entryCheckedAt=saved.entryCheckedAt||null;
  const maps=[...new Set((saved.sitemapQueue||[]).filter(u=>allowedStockSitemap(source,u)))];
  const pages=new Set(continuing?saved.visitedPages||[]:[]),mapSeen=new Set(continuing?saved.visitedSitemaps||[]:[]),processed=new Set();
  if(entryDue)pages.delete(entry.href);
  const d={source:source.name,pages:0,successfulPages:0,sitemaps:0,successfulSitemaps:0,discovered:0,detailAttempts:0,detailSuccess:0,records:0,rejectedReasons:{},errors:[],coverageComplete:false};
  let robots,stop=false,requestQueue=Promise.resolve();
  const response=async url=>fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)'}});
  async function readBody(r){const reader=r.body?.getReader();if(!reader)throw Error('empty-response');const chunks=[];let bytes=0;while(true){const v=await reader.read();if(v.done)break;bytes+=v.value.length;if(bytes>8000000){await reader.cancel();throw Error('response-too-large');}chunks.push(Buffer.from(v.value));}let b=Buffer.concat(chunks);if(b[0]===31&&b[1]===139)b=gunzipSync(b,{maxOutputLength:8000000});return b.toString('utf8');}
  async function pace(delay){const p=requestQueue.then(async()=>{if(stop||now()>=deadline)throw Error('collection-budget');await wait(delay);if(stop||now()>=deadline)throw Error('collection-budget');});requestQueue=p.catch(()=>{});return p;}
  async function get(url){for(let redirects=0;redirects<4;redirects++){
   const u=new URL(url);if(u.origin!==entry.origin||u.username||u.password)throw Error('unsafe-source-redirect');
   const policy=robotsPolicy(robots,u.href);if(!policy.allowed||policy.delayMs>30000)throw Error('source-policy');await pace(policy.delayMs);
   const r=await response(u.href);if([301,302,303,307,308].includes(r.status)){const location=r.headers.get('location');await r.body?.cancel();if(!location)throw Error('missing-redirect');url=new URL(location,u).href;continue;}
   if(!r.ok){await r.body?.cancel();if([401,403,429].includes(r.status))stop=true;throw Error('HTTP '+r.status);}return {html:await readBody(r),url:u.href};
  }throw Error('redirect-limit');}
  function discover(url){if(frontier.add(url))d.discovered++;}
  async function discovery(){
   // Source-published sitemaps expose the complete public URL set without guessing page numbers.
   if(maps.length&&d.sitemaps<maxSitemaps&&!(entryDue&&d.pages===0&&queue.includes(entry.href))){const url=maps.shift();if(mapSeen.has(url))return;d.sitemaps++;
    try{const {html}=await get(url);d.successfulSitemaps++;mapSeen.add(url);for(const raw of sitemapLocations(html)){if(stockIdentity(source,raw))discover(raw);else if(/<sitemapindex\b/i.test(html)&&allowedStockSitemap(source,raw)&&!mapSeen.has(raw)&&!maps.includes(raw)){if(maps.length<10000)maps.push(raw);else d.sitemapQueueOverflow=(d.sitemapQueueOverflow||0)+1;}}}
    catch(e){d.errors.push({stage:'sitemap',url,error:e.message.slice(0,150)});maps.unshift(url);stop=true;}
   }else if(queue.length&&d.pages<maxPages){const page=queue.shift();if(pages.has(page))return;d.pages++;
    try{const {html,url:pageUrl}=await get(page);d.successfulPages++;pages.add(page);if(page===entry.href)entryCheckedAt=new Date(now()).toISOString();stockLinks(html,source).forEach(discover);
     for(const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)){try{const u=new URL(m[1].replace(/&amp;/g,'&'),pageUrl),p=new URL(pageUrl),n=Number(u.searchParams.get('page'));if(validPage(u.href)&&Number.isInteger(n)&&n>Number(p.searchParams.get('page')||1)&&n<=10000&&!pages.has(u.href)&&!queue.includes(u.href))queue.push(u.href);}catch{}}
    }catch(e){d.errors.push({stage:'discovery',url:page,error:e.message.slice(0,150)});queue.unshift(page);stop=true;}
   }
  }
  async function detail(e){d.detailAttempts++;processed.add(stockIdentity(source,e.url));try{
   const detail=await get(e.url);d.detailSuccess++;if(stockIdentity(source,detail.url)!==stockIdentity(source,e.url))throw Error('redirect-changed-listing');
   const parsed=parseAdditionalStock(detail.html,detail.url,source),valid=parsed.records.filter(c=>['new','used'].includes(c.condition));
   for(const record of valid)listings.push(await validateMedia(record));
   const outcome=valid.length?'accepted':parsed.reason||'unknown-condition';frontier.finish(e.url,outcome,now());if(!valid.length){d.rejectedReasons[outcome]=(d.rejectedReasons[outcome]||0)+1;if(outcome==='unavailable')removedUrls.push(e.url);}
  }catch(e2){const reason=e2.message.slice(0,100);if(reason!=='collection-budget')frontier.finish(e.url,reason,now());d.rejectedReasons[reason]=(d.rejectedReasons[reason]||0)+1;if(/^HTTP (404|410)$/.test(reason))removedUrls.push(e.url);}
  d.records=listings.length;onProgress({...d,...frontier.stats()});}
  try{
   const r=await response(new URL('/robots.txt',source.url).href);if(r.ok)robots=await readBody(r);else if(r.status===404)robots='';else throw Error('robots-unavailable '+r.status);
   if(rescan){for(const m of robots.matchAll(/^Sitemap:\s*(\S+)/gim)){if(allowedStockSitemap(source,m[1])&&!maps.includes(m[1]))maps.push(m[1]);}}
   while(!stop&&now()<deadline){
    const canDiscover=(maps.length&&d.sitemaps<maxSitemaps)||(queue.length&&d.pages<maxPages);
    // Alternate discovery and details: older pending ads and refreshes cannot be starved by a large sitemap index.
    if(canDiscover&&!(d.detailAttempts===0&&frontier.due().length))await discovery();
    const due=frontier.due().filter(e=>!processed.has(stockIdentity(source,e.url))).slice(0,Math.min(24,maxDetails-d.detailAttempts));
    let cursor=0;await Promise.all(Array.from({length:Math.min(concurrency,due.length)},async()=>{while(cursor<due.length&&!stop&&now()<deadline)await detail(due[cursor++]);}));
    if(d.detailAttempts>=maxDetails||(!canDiscover&&!due.length))break;
   }
  }catch(e){d.errors.push({error:e.message.slice(0,150)});}
  const remaining=frontier.due().filter(e=>!processed.has(stockIdentity(source,e.url)));
  Object.assign(d,frontier.stats());d.pendingUrls=remaining.slice(0,100).map(e=>e.url);d.pendingPages=queue.slice(0,100);d.pendingSitemaps=maps.length;d.completedAt=new Date(now()).toISOString();d.durationMs=now()-started;d.budgetExhausted=now()>=deadline||d.detailAttempts>=maxDetails;d.discoveryExhausted=!maps.length&&!queue.length;
  return {listings,removedUrls,diagnostics:d,state:{...frontier.save(),pageQueue:queue,sitemapQueue:maps,visitedPages:[...pages],visitedSitemaps:[...mapSeen],entryCheckedAt,discoveryAt:rescan?new Date(started).toISOString():saved.discoveryAt||new Date(started).toISOString()}};
 }));return {listings:results.flatMap(r=>r.listings),removedUrls:results.flatMap(r=>r.removedUrls),diagnostics:results.map(r=>r.diagnostics),state:Object.fromEntries(results.map((r,i)=>[sources[i].id,r.state]))};
}
