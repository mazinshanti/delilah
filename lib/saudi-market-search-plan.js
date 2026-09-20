import {SOURCE_REGISTRY} from './source-registry.js';
// Search targets, not ingestion authorization or verified individual stock.
const additions=[
 {id:'mstaml',name:'مستعمل',url:'https://www.mstaml.com/',status:'discovery-only',evidence:'Public vehicle category and Saudi individual ads inspected 2026-09-20; mixed countries/categories require explicit Saudi and vehicle evidence'},
 {id:'expatriates-saudi',name:'Expatriates Saudi Vehicles',url:'https://www.expatriates.com/classifieds/saudi-arabia/vehicles-cars-trucks/',status:'discovery-only',evidence:'Saudi car category inspected 2026-09-20; includes wanted/scrap/service ads and malformed prices; no automatic inventory admission'},
 {id:'khaledcars',name:'Khaled Cars',url:'https://khaledcars.com/ar',status:'discovery-only',evidence:'Public priced vehicles and Riyadh branches inspected 2026-09-20'},
 {id:'tj4cars',name:'ظل الجزيرة للسيارات',url:'https://tj4cars.com/',status:'discovery-only',evidence:'Public vehicle sales page inspected 2026-09-20'},
 {id:'gcccardeals',name:'GCC Car Deals Saudi',url:'https://gcccardeals.com/en-sa',status:'discovery-only',evidence:'Saudi car comparison pages inspected 2026-09-20; trace original seller before admission'}
];
export const SAUDI_MARKET_SEARCH_TARGETS=[...SOURCE_REGISTRY,...additions].filter((s,i,a)=>a.findIndex(x=>x.url===s.url)===i).map(s=>({id:s.id,name:s.name,url:s.url,host:new URL(s.url).hostname,status:s.status,evidence:s.evidence||s.reason}));
export function saudiMarketSearchPlan(query){
 if(typeof query!=='string'||!query.trim()||query.length>180)throw Error('invalid-query');
 return [...SAUDI_MARKET_SEARCH_TARGETS.map(s=>({id:s.id,query:query.trim(),target:s.url,host:s.host,scope:'directory',accessStatus:s.status})),{id:'open-ar',query:query.trim(),scope:'open-market',language:'Arabic'},{id:'open-en',query:query.trim(),scope:'open-market',language:'English'}];
}
export function prioritizeExternalLead(raw){
 try{
 const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
 for(const key of [...u.searchParams.keys()])if(/^utm_/i.test(key)||['gclid','fbclid'].includes(key))u.searchParams.delete(key);u.hash='';
 const host=u.hostname.toLowerCase(),path=decodeURIComponent(u.pathname).toLowerCase();
 const editorial=/\/(?:r|wiki|newsroom|carsguide|blog|news|insights|compare)(?:\/|$)/i.test(path)||/(?:^|\.)(?:reddit\.com|wikipedia\.org|youtube\.com|montada\.haraj\.com\.sa)$/.test(host);
 const document=/\.pdf$/i.test(path)||/\/(?:export-pdf|download-specs)(?:\/|$)/.test(path);
 const catalog=/\/(?:full-specs|corolla-specs|sitemap|all-vehicles|view-catalog)(?:\/|$)/.test(path)||host==='www.toyota.com.sa';
 // Explicit regional routes only: unknown geography remains unknown.
 const foreign=(host==='www.gmcarabia.com'&&/^\/(?:bh|jo|om|ae|kw|qa)-(?:en|ar)(?:\/|$)/.test(path))
  ||(['audiapproved.com','www.audiapproved.com','vwcertified.me'].includes(host)&&/^\/(?:en|ar)\/(?:uae|qatar|bahrain|oman|kuwait)(?:\/|$)/.test(path));
 const internal=/^(?:admin|cms)\./.test(host);
 const priority=foreign?'outside-saudi':internal?'internal-route':editorial?'non-inventory':document?'document-review':catalog?'catalog-only':'source-review';
 // Group observed locale/slug variants without rewriting their source URLs.
 let identity=u.href;
 const dealerHost=host.replace(/^www\./,'');
 const detail=dealerHost==='khaledcars.com'?path.match(/^\/(?:index\.php\/)?(?:ar|en)\/car\/[^/]+\/(\d+)\/?$/)
  :dealerHost==='tj4cars.com'?path.match(/^\/cars\/(\d+)\/[^/]+\/?$/):null;
 if(detail)identity=dealerHost+':'+detail[1];
 return {url:u.href,identity,priority,vehicleVerified:false,saudiMarketVerified:false};
 }catch{return null;}
}
export function reviewDiscoveryLeads(rows){
 const grouped=new Map();let invalid=0;
 for(const row of rows){const lead=prioritizeExternalLead(row.url);if(!lead){invalid++;continue;}
  const key=lead.identity,existing=grouped.get(key);
  if(existing){if(!existing.observedUrls.includes(lead.url))existing.observedUrls.push(lead.url);if(row.discoveredBy&&!existing.discoveredBy.includes(row.discoveredBy))existing.discoveredBy.push(row.discoveredBy);}
  else grouped.set(key,{...lead,observedUrls:[lead.url],discoveredBy:row.discoveredBy?[row.discoveredBy]:[]});
 }
 const leads=[...grouped.values()],counts={};for(const x of leads)counts[x.priority]=(counts[x.priority]||0)+1;
 return {inputCount:rows.length,uniqueLeadGroups:leads.length,duplicateObservations:rows.length-invalid-leads.length,invalid,counts,leads,acceptedVehicles:0,coverageComplete:false};
}
