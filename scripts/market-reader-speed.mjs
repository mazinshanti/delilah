// Read-only transport benchmark. Does not measure browser rendering or AI discovery.
import {readFile,writeFile} from 'node:fs/promises';
import {marketCandidate,createMarketDetailReader,parseMarketDetail} from '../lib/ai-market-discovery-trial.js';
import {curlFetch} from './support/curl-fetch.mjs';
const candidate=marketCandidate((await readFile(process.argv[2],'utf8')).trim());if(!candidate)throw Error('unsupported-source-url');
const calls=[];const reader=createMarketDetailReader({fetchImpl:async(url,options)=>{calls.push({url,startedAt:new Date().toISOString()});return curlFetch(url,options);}});
const report={source:candidate.source.name,url:candidate.url,scope:'source-transport-only',startedAt:new Date().toISOString(),runs:[]};
for(const name of ['cold','warm','repeated']){const start=performance.now(),before=calls.length;try{const html=await reader(candidate),parsed=parseMarketDetail(candidate,html);report.runs.push({name,elapsedMs:performance.now()-start,networkRequests:calls.length-before,accepted:parsed.records.length,status:parsed.reason||'accepted'});}catch(e){report.runs.push({name,elapsedMs:performance.now()-start,networkRequests:calls.length-before,status:e.message});}}
await writeFile(process.argv[3]||'/tmp/reader-speed.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
