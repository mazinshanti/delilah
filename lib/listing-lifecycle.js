import {listingObservation} from '../public/listing-observation.js';
// Age is a refresh signal, never evidence of a sale or removal.
export function isInactiveListing(car={}) {
 const status=String(car.availability||'').replace(/^https?:\/\/(?:www\.)?schema\.org\//i,'').toLowerCase();
 return ['sold','soldout','removed','deleted','outofstock','discontinued'].includes(status);
}
export function listingFreshness(car,maxAgeMs=36*3600000,now=Date.now()) {
 const observation=listingObservation(car,now,maxAgeMs);
 return {lastCheckedAt:observation.observedAt,refreshDue:observation.status!=='recent',observationStatus:observation.status};
}
