import {deduplicateVehicles} from './inventory-index.js';
import {normalizeInventoryListing} from './inventory-normalizer.js';
import {filterVehicleSaleListings} from './listing-quality.js';
export function inventoryRefreshReport(snapshot,state={},now=Date.now()){
 const rows=snapshot.listings||[],accepted=filterVehicleSaleListings(rows.map(c=>normalizeInventoryListing(c))),fresh=accepted.filter(c=>{const at=Date.parse(c.lastSeenAt);return Number.isFinite(at)&&at<=now&&now-at<36*3600000;});
 const deduped=deduplicateVehicles(fresh),bySource={};
 for(const c of accepted){const group=bySource[c.source]??={stored:0,fresh:0,stale:0};group.stored++;const at=Date.parse(c.lastSeenAt);group[Number.isFinite(at)&&at<=now&&now-at<36*3600000?'fresh':'stale']++;}
 const sources=Object.entries(state).filter(([,v])=>Array.isArray(v.entries)).map(([sourceId,v])=>({sourceId,known:v.entries.length,due:v.entries.filter(e=>Number(e.nextCheckAt||0)<=now).length,failedLastCheck:v.entries.filter(e=>e.failures>0).length,paused:Number(v.pauseUntil)>now}));
 return {checkedAt:new Date(now).toISOString(),snapshotAt:snapshot.generatedAt,target:50000,rawRows:rows.length,validVehicleRows:accepted.length,freshRows:fresh.length,staleRows:accepted.length-fresh.length,deduplicatedFreshListings:deduped.length,remainingToTarget:Math.max(0,50000-deduped.length),targetReached:deduped.length>=50000,physicalVehicleUniquenessGuaranteed:false,bySource,refreshQueues:sources};
}
