import fs from 'node:fs';
import {marketDiscoveryPage,detailLinksFromDiscoveryPage,marketCandidate,createMarketDetailReader,parseMarketDetail} from '../lib/ai-market-discovery-trial.js';
import {curlFetch} from './support/curl-fetch.mjs';
const directory=process.argv[2];if(!directory)throw Error('usage: node scripts/verify-dealer-discovery.mjs AUDIT_DIRECTORY');
const report=JSON.parse(fs.readFileSync(directory+'/report.json','utf8'));
const read=createMarketDetailReader({fetchImpl:curlFetch});const rows=[];
for(const s of report.sources){const page=marketDiscoveryPage(s.url);if(!page||s.status!=='page-readable')continue;const links=detailLinksFromDiscoveryPage(fs.readFileSync(directory+'/'+s.id+'.html','utf8'),page);const row={source:s.name,discovered:links.length,checked:0,accepted:0,results:[]};
for(const url of links.slice(0,2)){row.checked++;try{const candidate=marketCandidate(url);const parsed=parseMarketDetail(candidate,await read(candidate));row.accepted+=parsed.records.length;row.results.push({url,status:parsed.records.length?'accepted':parsed.reason,records:parsed.records.map(r=>({title:r.title,make:r.make,model:r.model,year:r.year,price:r.price,mileage:r.mileage,condition:r.condition,image:r.image}))});}catch(e){row.results.push({url,status:e.message});}}
rows.push(row);console.log(JSON.stringify(row));fs.writeFileSync(directory+'/dealer-results.json',JSON.stringify({mode:'public-dealer-sample',coverageComplete:false,rows},null,2));}
