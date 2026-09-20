// Offline review: no API calls, no source fetching, no inventory writes.
import {readFile,writeFile} from 'node:fs/promises';
import {reviewDiscoveryLeads} from '../lib/saudi-market-search-plan.js';
const input=process.argv[2];if(!input)throw Error('report-path-required');
const data=JSON.parse(await readFile(input,'utf8'));
const rows=Array.isArray(data)?data:data.leads;if(!Array.isArray(rows))throw Error('missing-leads');
const report=reviewDiscoveryLeads(rows),output=input+'.review.json';
await writeFile(output,JSON.stringify(report,null,2));
const {leads,...summary}=report;console.log(JSON.stringify({...summary,reportPath:output},null,2));
