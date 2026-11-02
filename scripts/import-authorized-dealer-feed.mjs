import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {prepareAuthorizedDealerFeed} from '../lib/authorized-feed.js';

function argument(flag){
 const i=process.argv.indexOf(flag);
 return i<0?null:process.argv[i+1]||null;
}
const input=argument('--feed'),manifestPath=argument('--manifest');
const snapshotPath=argument('--snapshot')||'data/market-inventory.json.gz';
const output=argument('--output');
const dryRun=process.argv.includes('--dry-run');
if(!input||!manifestPath||(!output&&!dryRun)){
 console.error('Usage: node scripts/import-authorized-dealer-feed.mjs --feed partner.json --manifest permission.json --snapshot data/market-inventory.json.gz --output next-inventory.json.gz [--dry-run]');
 process.exit(2);
}
if(output&&[input,manifestPath,snapshotPath].some(p=>resolve(p)===resolve(output)))throw Error('refusing-to-overwrite-input');
const [feed,manifest]=await Promise.all([
 readFile(input,'utf8').then(JSON.parse),readFile(manifestPath,'utf8').then(JSON.parse)
]);
const prepared=prepareAuthorizedDealerFeed(feed,manifest);
const snapshot=JSON.parse(gunzipSync(await readFile(snapshotPath)).toString('utf8'));
if(!Array.isArray(snapshot.listings))throw Error('invalid-snapshot');
const byUrl=new Map(snapshot.listings.filter(x=>x?.url).map(x=>[x.url,x]));
let added=0,updated=0,collisions=0;
for(const next of prepared.records){
 const old=byUrl.get(next.url);
 // Permission to use one dealer feed never extends to records from another source.
 if(old&&old.source!==prepared.source){collisions++;continue;}
 if(old)updated++;else added++;
 byUrl.set(next.url,{
   ...old,...next,
   // Keep legacy gallery when an authorized refresh has no images.
   images:next.images?.length?next.images:(old?.images||[]),
   image:next.image||old?.image||null,
   firstSeenAt:old?.firstSeenAt||next.firstSeenAt,
   lastSeenAt:next.lastSeenAt
 });
}
const nextSnapshot={...snapshot,generatedAt:new Date().toISOString(),listings:[...byUrl.values()],
 diagnostics:[...(Array.isArray(snapshot.diagnostics)?snapshot.diagnostics:[]).slice(-99),
  {source:prepared.source,completedAt:new Date().toISOString(),adapter:'authorized-partner-json',
   feedRecords:prepared.report.submitted,added,updated,rejected:prepared.report.rejected}]
};
const report={...prepared.report,added,updated,unauthorizedUrlCollisions:collisions,
 before:snapshot.listings.length,after:nextSnapshot.listings.length,output:dryRun?'not-written':output,
 // This count is unique URLs, not guaranteed unique physical cars.
 countScope:'source-url'};
if(!dryRun)await writeFile(output,gzipSync(JSON.stringify(nextSnapshot)),{flag:'wx'});
console.log('AUTHORIZED_FEED_IMPORT '+JSON.stringify(report));
