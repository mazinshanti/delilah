// Observation is not a guarantee that a car is still listed or available.
// Accept only explicit source/index timestamps; never substitute the current time.
export function listingObservation(car={},now=Date.now(),maxAgeMs=36*3600000){
 const values=[car.lastDetailAt,car.lastCheckedAt,car.lastSeenAt].map(value=>{
  const n=Date.parse(value);
  return Number.isFinite(n)?n:null;
 }).filter(value=>value!==null&&value<=now);
 if(!values.length)return {status:'unknown',observedAt:null,ageMs:null};
 const observedAtMs=Math.max(...values),ageMs=now-observedAtMs;
 const status=ageMs>=maxAgeMs?'stale':'recent';
 return {status,observedAt:new Date(observedAtMs).toISOString(),ageMs};
}
