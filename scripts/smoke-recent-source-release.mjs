const base='https://www.dalelah.co';
const expected='aac6b477d2de08ef59121df6efb6f45c94002526';
const report={};
try{
 const health=await fetch(base+'/healthz',{signal:AbortSignal.timeout(12000)}).then(r=>r.json());
 report.commit=health.renderGitCommit;report.commitOk=report.commit===expected;
 const r=await fetch(base+'/api/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'Toyota Camry',condition:'used',filters:{},freshOnly:true}),signal:AbortSignal.timeout(20000)});
 const d=await r.json();
 report.ok=r.ok;report.freshOnly=d.freshOnly;
 report.count=d.listings?.length||0;report.scanStatus=d.scanStatus;
 report.invalid=(d.listings||[]).filter(c=>c.sourceObservationEvidence!=='source-search-result-page'||!c.sourceObservedAt||Date.now()-Date.parse(c.sourceObservedAt)>600000).length;
 const normalStart=Date.now();
 const normalResponse=await fetch(base+'/api/search',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({query:'Toyota Camry',condition:'used',filters:{}}),signal:AbortSignal.timeout(20000)});
 const normal=await normalResponse.json();
 report.normalSearchCount=normal.listings?.length||0;
 report.normalSearchMs=Date.now()-normalStart;
 report.normalOk=normalResponse.ok&&normal.freshOnly===false&&report.normalSearchCount>0;
 report.passed=report.commitOk&&report.ok&&report.freshOnly===true&&report.invalid===0&&report.normalOk;
}catch(e){report.passed=false;report.error=String(e)}
console.log('RECENT_SOURCE_RELEASE_SMOKE '+JSON.stringify(report));
if(!report.passed)process.exitCode=1;
