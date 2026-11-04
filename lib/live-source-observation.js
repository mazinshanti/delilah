// A successfully fetched public search results page is evidence of a recent
// observation of that listing URL, NOT evidence that a vehicle is still for sale.
const validStamp=(v,now=Date.now())=>{
 const at=Date.parse(v);
 return Number.isFinite(at)&&at>0&&at<=now+30_000?at:0;
};

export function observeSourceSearchListings(listings=[],source,observedAt=new Date().toISOString()){
 if(!validStamp(observedAt))return listings;
 return (Array.isArray(listings)?listings:[]).map(car=>
  car&&car.source===source&&typeof car.url==='string'&&car.url
    ?{...car,lastSeenAt:observedAt,sourceObservedAt:observedAt,
       sourceObservationEvidence:'source-search-result-page'}
    :car
 );
}

export function mergeObservationFields(old={},next={},now=Date.now()){
 const oldLive=validStamp(old.sourceObservedAt,now);
 const nextLive=validStamp(next.sourceObservedAt,now);
 const live=nextLive>=oldLive?next:old;
 const liveAt=Math.max(oldLive,nextLive);
 const seen=[old.lastSeenAt,next.lastSeenAt,old.lastDetailAt,next.lastDetailAt]
  .map(v=>validStamp(v,now)).filter(Boolean);
 if(liveAt)seen.push(liveAt);
 const latest=seen.length?Math.max(...seen):0;
 // An explicit live-page sighting is never lost to a subsequent old snapshot.
 return {
  lastSeenAt:latest?new Date(latest).toISOString():old.lastSeenAt||next.lastSeenAt||null,
  sourceObservedAt:liveAt?new Date(liveAt).toISOString():null,
  sourceObservationEvidence:liveAt?live.sourceObservationEvidence||'source-search-result-page':null
 };
}
export function favorNewerVerifiedData(old={},next={},now=Date.now()){
 // Prefer the listing with newer *real source observations*, falling back to
 // explicit source timestamps; do not decide by JSON merge ordering.
 const oldLive=validStamp(old.sourceObservedAt,now),newLive=validStamp(next.sourceObservedAt,now);
 // A known source-page observation beats a weaker timestamp potentially
 // minted while normalizing an older stored record.
 if(oldLive!==newLive&&(!oldLive||!newLive))return oldLive?'old':'next';
 const time=c=>validStamp(c.sourceObservedAt,now)||validStamp(c.lastDetailAt,now)||validStamp(c.lastSeenAt,now);
 return time(old)>time(next)?'old':'next';
}
