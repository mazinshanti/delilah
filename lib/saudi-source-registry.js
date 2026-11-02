// Registry of source integrations observed in the Dalelah repository.
// codeStatus describes implementation presence, not live availability or authorization.
// Authorization must be checked independently before ingestion or crawling.
export const SAUDI_SOURCES=Object.freeze([
  {id:'haraj',name:'Haraj',codeStatus:'fast-search',module:'lib/haraj-fast-source.js',permission:'unverified'},
  {id:'opensooq',name:'OpenSooq Saudi',codeStatus:'fast-search',module:'lib/opensooq-source.js',permission:'unverified'},
  {id:'saleh',name:'Saleh Cars',codeStatus:'fast-search',module:'lib/saleh-fast-source.js',permission:'unverified'},
  {id:'carswitch',name:'CarSwitch Saudi',codeStatus:'server-integration',module:'server-v15-carswitch.js',permission:'unverified'},
  {id:'syarah',name:'Syarah',codeStatus:'enrichment',module:'lib/syarah-price-enrichment.js',permission:'unverified'},
  {id:'yallamotor',name:'YallaMotor',codeStatus:'needs-audit',module:null,permission:'unverified'},
  {id:'saud sale',name:'SaudiSale',codeStatus:'needs-audit',module:null,permission:'unverified'},
  {id:'dubizzle',name:'Dubizzle Saudi',codeStatus:'needs-audit',module:null,permission:'unverified'},
  {id:'mstaml',name:'Mstaml',codeStatus:'needs-audit',module:null,permission:'unverified'},
  {id:'kayishha',name:'Kayishha',codeStatus:'needs-audit',module:null,permission:'unverified'},
  {id:'dealers',name:'Saudi dealerships',codeStatus:'feed-partnerships-needed',module:null,permission:'unverified'}
]);

export function sourceCoverageReport(results=[],registry=SAUDI_SOURCES){
  const seen=new Map(results.map(result=>[String(result.id||result.name||'').toLowerCase(),result]));
  return registry.map(source=>{
    const hit=seen.get(source.id)||seen.get(source.name.toLowerCase());
    const pagesAttempted=Math.max(0,Number(hit?.pagesAttempted)||0);
    const pagesSucceeded=Math.max(0,Math.min(pagesAttempted,Number(hit?.pagesSucceeded)||0));
    return {
      id:source.id,name:source.name,codeStatus:source.codeStatus,
      permission:source.permission,
      state:!hit?'not-checked':hit.error?'partial-or-failed':'reported-success',
      listingsReported:Math.max(0,Number(hit?.count)||0),
      pagesAttempted,pagesSucceeded,
      error:hit?.error||null
    };
  });
}
