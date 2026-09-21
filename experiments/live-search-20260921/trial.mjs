// Isolated on-demand retrieval trial. No inventory imports, HTML files or image downloads.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {parseHarajFastPage,localizedQuery} from '../../lib/haraj-fast-source.js';
import {openSooqSearchUrl,parseOpenSooqPage} from '../../lib/opensooq-source.js';
import {harajListingEvidence} from '../../lib/haraj-listing-evidence.js';
import {strictDirectListings,mergeDirectListings} from '../../lib/direct-search.js';
import {applyIntentConstraints,validateIntent,ORIGINS} from '../../lib/ai-search-intent.js';
import {parseStructuredInventory} from '../../lib/public-inventory.js';
import {catalogIntent} from '../../public/catalog.js';
const exec=promisify(execFile), root='https://www.dalelah.co';
const allowed=new Set(['www.dalelah.co','haraj.com.sa','sa.opensooq.com']);
const requests=[];
async function request(raw,body,hop=0){
 const u=new URL(raw);if(u.protocol!=='https:'||!allowed.has(u.hostname)||u.username||u.password||u.port)throw Error('unsupported-target');
 const start=performance.now();
 const args=['-sS','--max-time','25','--include','--max-filesize','5000000','--write-out','\n%{http_code}','--user-agent','Dalelah/1.5 (+https://dalelah.co; isolated-live-search-trial)'];
 if(body)args.push('-H','Content-Type: application/json','--data-binary',JSON.stringify(body));
 args.push(u.href);
 try{
  const {stdout}=await exec('curl',args,{maxBuffer:5100000,timeout:27000});
  const split=stdout.lastIndexOf('\n'),status=Number(stdout.slice(split+1)),wire=stdout.slice(0,split);
  let text=wire,header='';while(text.startsWith('HTTP/')){const at=text.indexOf('\r\n\r\n');if(at<0)break;header=text.slice(0,at);text=text.slice(at+4);}
  requests.push({host:u.hostname,status,ms:Math.round(performance.now()-start),bytes:Buffer.byteLength(text)});
  if([301,302,303,307,308].includes(status)&&hop<3){const location=header.match(/^location:\s*(.+)$/im)?.[1]?.trim();if(!location)throw Error('redirect-without-location');const next=new URL(location,u);if(next.hostname!==u.hostname)throw Error('cross-host-redirect');if(u.hostname==='haraj.com.sa'&&/^\/\d{8,}/.test(u.pathname)&&next.pathname.split('/')[1]!==u.pathname.split('/')[1])throw Error('different-ad-redirect');return request(next.href,body,hop+1);}
  if(status!==200)throw Error('http-'+status);return text;
 }catch(e){if(!requests.at(-1)||requests.at(-1).host!==u.hostname||requests.at(-1).status===undefined)requests.push({host:u.hostname,error:'transport-error',ms:Math.round(performance.now()-start)});throw Error(e.message.startsWith('http-')?e.message:'transport-error');}
}
const cases=[
 {id:'corolla-en',query:'Toyota Corolla under 45000 in Jeddah',condition:'used'},
 {id:'suv-ar',query:'ابي جيب عائلي ياباني تحت 150 ألف في الرياض',condition:'used'},
 {id:'new-ar',query:'تويوتا كورولا جديدة تحت 100 ألف',condition:'new'}
];
const summarize=data=>({count:data.listings?.length||0,indexedCount:data.indexedCount,complete:data.complete,partial:data.partial,intentMode:data.intentMode,ai:data.ai,sources:data.counts,rows:(data.listings||[]).slice(0,5).map(c=>({url:c.url,title:c.title,price:c.price,city:c.city,condition:c.condition}))});
async function run(c){
 const began=performance.now();let baseline;
 try{baseline=JSON.parse(await request(root+'/api/search',{query:c.query,condition:c.condition}));}
 catch(e){return {...c,status:'baseline-unavailable',error:e.message};}
 const firstMs=Math.round(performance.now()-began),i=baseline.intent;
 // Reuse production interpretation only; production listings never enter the live-only lane.
 if(!validateIntent(i)||baseline.interpretationUnavailable)return {...c,status:'interpretation-unavailable',baseline:summarize(baseline),intent:i};
 const filters=Object.fromEntries(['minPrice','maxPrice','minYear','maxYear','city','fuelType'].filter(k=>i[k]!=null).map(k=>[k,i[k]]));
 if(i.year)filters.minYear=filters.maxYear=i.year;
 const exact=[i.make,i.model,i.year].filter(Boolean).join(' ');
 const queries=exact?[exact]:i.originPreference==='Japanese'?['Toyota','Nissan','Mazda']:[];
 if(!queries.length)return {...c,status:'no-bounded-query-plan',intent:i};
 const retrievalStart=performance.now();let firstCandidateMs=null;
 const lanes=await Promise.all(queries.flatMap(query=>['Haraj','OpenSooq'].map(async source=>{
  const started=performance.now();
  const url=source==='Haraj'?`https://haraj.com.sa/search/${encodeURIComponent(localizedQuery(query))}/`:openSooqSearchUrl({query,filters});
  try{
   const html=await request(url);
   const candidates=source==='Haraj'?parseHarajFastPage(html,url,{query,filters:{},limit:12}):parseOpenSooqPage(html,{query,condition:c.condition,filters:{}});
   if(candidates.length&&firstCandidateMs===null)firstCandidateMs=Math.round(performance.now()-retrievalStart);
   const verified=[];const detailErrors=[];
   // Bounded sequential detail requests within each source/query lane.
   const shortlist=applyIntentConstraints(strictDirectListings(candidates,{query:exact||'',condition:c.condition,filters}),i).slice(0,2);
   for(const car of shortlist){
    try{
     const detail=await request(car.url);
     if(source==='Haraj'){
      const hit=harajListingEvidence(detail,car.url);if(!hit){detailErrors.push('exact-ad-evidence-missing');continue;}
      verified.push({...car,title:hit.title,description:hit.description,snippet:hit.description,price:hit.priceHit?.price??null,priceVerified:Boolean(hit.priceHit),priceEvidence:hit.priceHit?.evidence??null,mileage:hit.mileage,condition:hit.condition,year:hit.structuredYear||car.year,images:hit.images,detailChecked:true});
     }else{
      const rows=[...parseOpenSooqPage(detail,{query,condition:c.condition,filters:{}}),...parseStructuredInventory(detail,{id:'opensooq',name:'OpenSooq',url:'https://sa.opensooq.com',detailPattern:/^\/en\/search\/\d+/})].filter(x=>x.url.replace(/\/$/,'')===car.url.replace(/\/$/,''));
      if(!rows.length)detailErrors.push('exact-ad-evidence-missing');
      verified.push(...rows.map(x=>({...x,detailChecked:true})));
     }
    }catch(e){detailErrors.push(e.message);}
   }
   let matches=applyIntentConstraints(strictDirectListings(verified,{query:exact||'',condition:c.condition,filters}),i);
   if(i.originPreference)matches=matches.filter(x=>(ORIGINS[i.originPreference]||[]).includes(catalogIntent(x.make||x.brand||x.title).make));
   return {source,query,url,candidates:candidates.length,detailsChecked:shortlist.length,matches,detailErrors,ms:Math.round(performance.now()-started)};
  }catch(e){return {source,query,url,candidates:0,matches:[],error:e.message,ms:Math.round(performance.now()-started)};}
 })));
 const elapsed=Math.round(performance.now()-retrievalStart);
 let final=baseline;
 // One comparable later snapshot, never claim a full-market count from partial results.
 if(baseline.searchId)try{final=JSON.parse(await request(root+'/api/search/progress/'+encodeURIComponent(baseline.searchId)));}catch{}
 const matches=mergeDirectListings(...lanes.map(l=>l.matches));
 return {...c,status:'measured',intent:i,intentOrigin:'production-search-response; also triggers existing search',baselineFirstMs:firstMs,baselineFirst:summarize(baseline),baselineLater:summarize(final),liveOnly:{count:matches.length,firstCandidateMs,totalMs:elapsed,lanes,matches,inventoryRead:false,inventoryWritten:false,imagesDownloaded:0,coverageComplete:false},memory:process.memoryUsage()};
}
const report={at:new Date().toISOString(),baseCommit:'07d4cfd19dd4bfaddc49198633a879b079099645',method:'live source experiment; production intent bridge; no independent AI/search-provider API credentials',cases:[],requests};
for(const c of cases.filter(c=>!process.env.TRIAL_CASE||c.id===process.env.TRIAL_CASE)){const result=await run(c);report.cases.push(result);console.log(JSON.stringify({id:c.id,status:result.status,live:result.liveOnly?.count,baseline:result.baselineFirst?.count,liveMs:result.liveOnly?.totalMs}));await writeFile(new URL('./'+(process.env.TRIAL_REPORT||'results.json'),import.meta.url),JSON.stringify(report,null,2));}
