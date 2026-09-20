import {SOURCE_REGISTRY} from './source-registry.js';
// Search targets, not ingestion authorization or verified individual stock.
const additions=[
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
 try{const u=new URL(raw);for(const key of [...u.searchParams.keys()])if(/^utm_/i.test(key)||['gclid','fbclid'].includes(key))u.searchParams.delete(key);u.hash='';
 const editorial=/\/(?:r|wiki|newsroom|carsguide|blog|news)(?:\/|$)/i.test(u.pathname)||/(?:^|\.)(?:reddit\.com|wikipedia\.org|youtube\.com)$/.test(u.hostname);
 const document=/\.pdf$/i.test(u.pathname)||/\/export-pdf\//.test(u.pathname);
 return {url:u.href,priority:editorial?'non-inventory':document?'document-review':'source-review',vehicleVerified:false};
 }catch{return null;}
}
