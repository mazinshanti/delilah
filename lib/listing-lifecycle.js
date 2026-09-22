// Age is a refresh signal, never evidence of a sale or removal.
export function isInactiveListing(car={}) {
 const status=String(car.availability||'').replace(/^https?:\/\/(?:www\.)?schema\.org\//i,'').toLowerCase();
 return ['sold','soldout','removed','deleted','outofstock','discontinued'].includes(status);
}
export function listingFreshness(car,maxAgeMs=36*3600000,now=Date.now()) {
 const lastCheckedAt=[car.lastDetailAt,car.lastSeenAt].filter(v=>Number.isFinite(Date.parse(v))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null,at=Date.parse(lastCheckedAt);
 return {lastCheckedAt,refreshDue:!Number.isFinite(at)||at>now||now-at>=maxAgeMs};
}
