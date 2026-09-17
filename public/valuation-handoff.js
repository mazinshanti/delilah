export const HANDOFF_KEY='dalelah.valuation-handoff';
export function valuationHandoff(result,now=Date.now()){
 const v=result.vehicle||{},fields={};
 for(const k of ['make','model','year','mileageKm','city','trim'])if(v[k]!=null)fields[k]=v[k];
 if(result.available&&Number.isFinite(result.recommendedListingPrice))fields.askingPriceSar=result.recommendedListingPrice;
 // Keep optional details in the existing description; no seller storage schema changes.
 return{createdAt:now,fields,optional:Object.fromEntries(['engine','transmission','driveType','exteriorColor','specification','owners','accidentHistory','serviceHistory','vehicleCondition'].filter(k=>v[k]).map(k=>[k,v[k]]))};
}
export function readValuationHandoff(raw,now=Date.now()){
 try{const x=JSON.parse(raw);if(!Number.isFinite(x.createdAt)||now-x.createdAt>3600000||x.createdAt>now+60000||!x.fields||typeof x.fields.make!=='string'||typeof x.fields.model!=='string')return null;return x;}catch{return null;}
}
