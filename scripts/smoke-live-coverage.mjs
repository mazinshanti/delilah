const started=Date.now();
const url=String(process.env.DALELAH_SITE||'https://www.dalelah.co').replace(/\/$/,'')+'/api/inventory/coverage';
const result={url,at:new Date().toISOString(),status:'unknown'};
try{
 const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
 result.http=response.status;
 const data=await response.json();
 result.responseMs=Date.now()-started;
 result.generatedAt=data.generatedAt||null;
 result.indexedUrlCount=data.indexedUrlCount;
 result.freshUrlCount=data.freshUrlCount;
 result.observedSources=data.observedSources;
 result.marketCoveragePct=data.marketCoveragePct;
 result.marketExhaustive=data.marketExhaustive;
 result.topSources=(data.representedSources||[]).filter(x=>x.indexedUrlCount>0).slice(0,8).map(x=>({
  name:x.name,urls:x.indexedUrlCount,fresh:x.freshUrlCount,askingPriceEvidencePct:x.askingPriceEvidencePct
 }));
 const valid=response.ok&&Number.isInteger(data.indexedUrlCount)&&data.indexedUrlCount>=1000&&
  Array.isArray(data.representedSources)&&data.observedSources>=4&&
  data.marketCoveragePct===null&&data.marketExhaustive===false;
 result.status=valid?'pass':'fail';
}catch(error){result.status='error';result.error=String(error?.message||error)}
console.log('LIVE_COVERAGE_SMOKE '+JSON.stringify(result));
if(result.status!=='pass')process.exitCode=1;
