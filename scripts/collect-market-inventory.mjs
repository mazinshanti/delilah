import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {gzipSync,gunzipSync} from 'node:zlib';
import {robotsPolicy} from '../lib/robots-policy.js';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {SOURCE_REGISTRY} from '../lib/source-registry.js';
import {parseStructuredInventory,parseSyarahInventory,parseSaudiSaleInventory} from '../lib/public-inventory.js';
const exec=promisify(execFile),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const maxPages=Number(process.env.MARKET_PAGES||100);
await mkdir('data',{recursive:true});await mkdir('audit',{recursive:true});
const all=new Map(),diagnostics=[];
try{const old=JSON.parse(gunzipSync(await readFile('data/market-inventory.json.gz')));for(const r of old.listings||[])if(Date.now()-Date.parse(r.lastSeenAt)<36*3600000)all.set(r.url,r);}catch{}
async function get(url){const {stdout}=await exec('curl',['-sS','--max-time','30','--max-filesize','12000000','-A','Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)','-w','\n%{http_code}',url],{maxBuffer:12_000_000});const i=stdout.lastIndexOf('\n');const status=Number(stdout.slice(i+1));if(status!==200)throw new Error('HTTP '+status);return stdout.slice(0,i);}
const parsers={jsonld:parseStructuredInventory,syarah:parseSyarahInventory,saudisale:parseSaudiSaleInventory};
async function collect(source){
 const started=Date.now(),seen=new Set(),errors=[];let attempted=0,successfulPages=0,duplicates=0,robots='';
 try{robots=await get(new URL('/robots.txt',source.url).href);}catch(e){diagnostics.push({source:source.name,records:0,errors:[{error:'robots-unavailable: '+e.message}]});return;}
 for(let page=1;page<=(source.id==='mercedes'?1:maxPages);page++){
  const url=new URL(source.path,source.url);if(page>1)url.searchParams.set('page',String(page));
  attempted++;
  try{
   const policy=robotsPolicy(robots,url.href);if(!policy.allowed)throw new Error('robots-disallowed');
   await sleep(policy.delayMs);
   const stdout=await get(url.href);
   const records=parsers[source.adapter](stdout,source);successfulPages++;let added=0;
   for(const r of records){if(seen.has(r.url)){duplicates++;continue;}seen.add(r.url);all.set(r.url,r);added++;}
   console.log(JSON.stringify({source:source.name,page,records:records.length,added,total:seen.size}));
   if(!added){if(!records.length)errors.push({page,error:'no-parseable-records-or-source-blocked'});break;}
  }catch(e){errors.push({page,error:e.message.slice(0,180)});break;}
  await sleep(1100);
 }
 diagnostics.push({source:source.name,pages:attempted,successfulPages,completedAt:new Date().toISOString(),records:seen.size,duplicateCards:duplicates,errors,durationMs:Date.now()-started});
 
}
await Promise.all(SOURCE_REGISTRY.filter(s=>parsers[s.adapter]).map(collect));
if(!diagnostics.some(d=>d.records>0))throw new Error('No source successfully refreshed; preserving previous snapshot');
await writeFile('data/market-inventory.json.gz',gzipSync(JSON.stringify({generatedAt:new Date().toISOString(),listings:[...all.values()],diagnostics})));
console.log(JSON.stringify({totalUnique:all.size,diagnostics}));
