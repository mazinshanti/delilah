// Search-result evidence from a fetched source page (not an assumption of sale).
// Only real, explicitly stamped source-search observations qualify here.
const ALLOWED=new Set(['Haraj','OpenSooq']);
export function isRecentlyObservedAtSource(car={},now=Date.now(),ttlMs=10*60_000){
 const at=Date.parse(car.sourceObservedAt||'');
 return ALLOWED.has(car.source)&&car.sourceObservationEvidence==='source-search-result-page'&&
   Number.isFinite(at)&&at>0&&at<=now&&now-at<ttlMs;
}
export function filterRecentlyObservedSourceResults(listings=[],now=Date.now(),ttlMs=10*60_000){
 return (Array.isArray(listings)?listings:[]).filter(car=>isRecentlyObservedAtSource(car,now,ttlMs));
}
