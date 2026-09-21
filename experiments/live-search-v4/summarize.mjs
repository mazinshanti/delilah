import {readFile,writeFile} from 'node:fs/promises';
const report=JSON.parse(await readFile(new URL('./pilot-results.json',import.meta.url)));
const median=a=>{a.sort((x,y)=>x-y);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2:null;};
const summary={at:report.at,casesExpected:4,runsExpected:8,runsCompleted:report.runs.length,providerStudyCompleted:false,arms:{}};
for(const mode of ['baseline','scheduled']){const runs=report.runs.filter(r=>r.mode===mode);summary.arms[mode]={queries:runs.length,noResultQueries:runs.filter(r=>!r.result.matches.length).length,acceptedAds:runs.reduce((n,r)=>n+r.result.matches.length,0),firstResultMedianAmongSuccessesMs:median(runs.map(r=>r.result.firstResultMs).filter(v=>v!==null)),detailAttempts:runs.reduce((n,r)=>n+r.result.detailsAttempted,0),networkRequests:runs.reduce((n,r)=>n+r.requests.length,0)};}
await writeFile(new URL('./pilot-summary.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
