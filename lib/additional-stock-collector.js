import {stockMediaValidator} from './additional-stock-media.js';
import {ADDITIONAL_MARKET_SOURCES,stockLinks,stockIdentity,parseAdditionalStock} from './additional-market-sources.js';
import {robotsPolicy} from './robots-policy.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Runs during scheduled index refresh, never on the user's search request.
export async function collectAdditionalStock({fetchImpl=fetch,maxPages=3,maxDetails=60,wait=sleep,onProgress=()=>{},sources=ADDITIONAL_MARKET_SOURCES,previousDiagnostics=[]}={}){
 maxPages=Math.max(1,Math.min(10,Number(maxPages)||3));maxDetails=Math.max(1,Math.min(200,Number(maxDetails)||60));
 const validateMedia=stockMediaValidator(fetchImpl);
 const results=await Promise.all(sources.map(async source=>{
  const listings=[],started=Date.now(),seen=new Set(),pages=new Set(),entry=new URL(source.path,source.url),previous=previousDiagnostics.find(d=>d.source===source.name);
  const queue=[...new Set([...(previous?.pendingPages||[]).filter(raw=>{try{const u=new URL(raw);return u.origin===entry.origin&&u.pathname===entry.pathname;}catch{return false;}}).slice(0,100),entry.href])];
  const details=[...new Map((previous?.pendingUrls||[]).filter(url=>stockIdentity(source,url)).slice(0,1000).map(url=>[stockIdentity(source,url),url])).values()];for(const url of details)seen.add(stockIdentity(source,url));
  const d={source:source.name,pages:0,successfulPages:0,discovered:0,detailAttempts:0,detailSuccess:0,records:0,rejectedReasons:{},errors:[],coverageComplete:false};
  let robots;
  const response=async url=>fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)'}});
  const text=async r=>{const h=await r.text();if(Buffer.byteLength(h)>5000000)throw Error('response-too-large');return h;};
  async function get(url){for(let redirects=0;redirects<4;redirects++){
   const u=new URL(url);if(u.origin!==new URL(source.url).origin||u.username||u.password)throw Error('unsafe-source-redirect');
   const policy=robotsPolicy(robots,u.href);if(!policy.allowed||policy.delayMs>30000)throw Error('source-policy');await wait(policy.delayMs);
   const r=await response(u.href);if([301,302,303,307,308].includes(r.status)){url=new URL(r.headers.get('location'),u).href;continue;}
   if(!r.ok)throw Error('HTTP '+r.status);return {html:await text(r),url:u.href};
  }throw Error('redirect-limit');}
  try{
   const r=await response(new URL('/robots.txt',source.url).href);if(r.ok)robots=await text(r);else if(r.status===404)robots='';else throw Error('robots-unavailable '+r.status);
   d.discovered=details.length;
   while(d.detailAttempts<maxDetails&&(details.length||(queue.length&&d.pages<maxPages))){
    if(!details.length){
     const page=queue.shift();if(pages.has(page))continue;pages.add(page);d.pages++;
     const {html,url:pageUrl}=await get(page);d.successfulPages++;
     const candidates=stockLinks(html,source).filter(url=>{const id=stockIdentity(source,url);if(seen.has(id))return false;seen.add(id);return true;});d.discovered+=candidates.length;details.push(...candidates);
     // Advance through observed pages across refreshes, rather than repeatedly importing page one.
     for(const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)){try{const u=new URL(m[1].replace(/&amp;/g,'&'),pageUrl),p=new URL(pageUrl);const n=Number(u.searchParams.get('page'));
      if(u.origin===p.origin&&u.pathname===p.pathname&&Number.isInteger(n)&&n>Number(p.searchParams.get('page')||1)&&n<=10000&&!pages.has(u.href)&&!queue.includes(u.href))queue.push(u.href);
     }catch{}}
     continue;
    }
    const url=details.shift();d.detailAttempts++;try{
     const detail=await get(url);d.detailSuccess++;if(stockIdentity(source,detail.url)!==stockIdentity(source,url))throw Error('redirect-changed-listing');
     const parsed=parseAdditionalStock(detail.html,detail.url,source);const valid=parsed.records.filter(c=>['new','used'].includes(c.condition));for(const record of valid)listings.push(await validateMedia(record));if(!valid.length){const reason=parsed.reason||'unknown-condition';d.rejectedReasons[reason]=(d.rejectedReasons[reason]||0)+1;}
    }catch(e){const reason=e.message.slice(0,100);d.rejectedReasons[reason]=(d.rejectedReasons[reason]||0)+1;}
    d.records=listings.length;onProgress({...d});
   }
  }catch(e){d.errors.push({error:e.message.slice(0,150)});}
  d.pendingUrls=details.slice(0,1000);d.pendingPages=queue.filter(url=>!pages.has(url)).slice(0,100);d.pending=d.pendingUrls.length;d.completedAt=new Date().toISOString();d.durationMs=Date.now()-started;
  return {listings,diagnostics:d};
 }));return {listings:results.flatMap(r=>r.listings),diagnostics:results.map(r=>r.diagnostics)};
}
