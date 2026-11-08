// Source-search-page observation is only credible when the listing URL
// actually belongs to the claimed marketplace. No network requests happen here.
const TEN_MINUTES=10*60_000;
export function isSupportedListingSource(car={}){
 if(!car||typeof car.url!=='string'||car.url.length>1800)return false;
 let u;try{u=new URL(car.url)}catch{return false}
 if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
 const host=u.hostname.toLowerCase();
 if(car.source==='Haraj')
  return (host==='haraj.com.sa'||host==='www.haraj.com.sa') &&
    /^\/\d{8,}(?:\/[^/]+)?\/?$/.test(u.pathname);
 if(car.source==='OpenSooq')
  return host==='sa.opensooq.com'&&/^\/en\/search\/\d{6,}\/?$/.test(u.pathname);
 return false;
}
export function isRecentlyObservedAtSource(car={},now=Date.now(),ttlMs=TEN_MINUTES){
 if(!isSupportedListingSource(car)||car.sourceObservationEvidence!=='source-search-result-page')return false;
 const at=Date.parse(car.sourceObservedAt||'');
 return Number.isFinite(at)&&at>0&&at<=now&&now-at<ttlMs;
}
export function filterRecentlyObservedSourceResults(listings=[],now=Date.now(),ttlMs=TEN_MINUTES){
 return (Array.isArray(listings)?listings:[]).filter(car=>isRecentlyObservedAtSource(car,now,ttlMs));
}

/** Only show URLs actually sighted on a supported source results page after this request started. */
export function filterObservedDuringSearch(listings=[],startedAt=Date.now(),now=Date.now()){
 const earliest=Number(startedAt);
 if(!Number.isFinite(earliest)||earliest<=0)return [];
 return (Array.isArray(listings)?listings:[]).filter(car=>{
  if(!isRecentlyObservedAtSource(car,now))return false;
  const observed=Date.parse(car.sourceObservedAt||'');
  return observed>=earliest-1000;
 });
}
