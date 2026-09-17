// Decode public React Router page data as JSON only. Never execute source scripts.
// Only exact listing URLs can contribute evidence; surrounding ads cannot.
export function harajClassificationEvidence(html=''){
 const byId=new Map();
 for(const match of String(html).matchAll(/streamController\.enqueue\(("(?:\\.|[^"\\])*")\)/g)){
  let table;try{table=JSON.parse(JSON.parse(match[1]));}catch{continue;}
  if(!Array.isArray(table)||table.length>100000)continue;
  const resolve=(index,depth=0)=>{
   if(!Number.isInteger(index)||index<0||index>=table.length||depth>8)return null;
   const value=table[index];
   if(Array.isArray(value))return value.map(i=>resolve(i,depth+1));
   if(value&&typeof value==='object'){const result=Object.create(null);for(const [key,ref] of Object.entries(value)){if(!/^_\d+$/.test(key))continue;const name=table[Number(key.slice(1))];if(typeof name==='string'&&!['__proto__','constructor','prototype'].includes(name))result[name]=resolve(ref,depth+1);}return result;}
   return value;
  };
  for(let i=0;i<table.length;i++){
   const node=table[i];if(!node||Array.isArray(node)||typeof node!=='object')continue;
   const keys=Object.keys(node).map(k=>/^_\d+$/.test(k)?table[Number(k.slice(1))]:null);
   if(!keys.includes('URL')||!keys.includes('title'))continue;
   const post=resolve(i);let url;try{url=new URL(post.URL,'https://haraj.com.sa/');}catch{continue;}
   if(url.hostname!=='haraj.com.sa'||!/^\/\d{8,}\//.test(url.pathname))continue;
   const tags=Array.isArray(post.tags)?post.tags.filter(t=>typeof t==='string'):[];
   byId.set(url.pathname.split('/')[1],{source_listing_id:String(post.id||''),sourceCategory:tags.join(' '),description:typeof post.bodyTEXT==='string'?post.bodyTEXT:'',schemaType:post.carInfo?.carOrRelated==='CAR'?'Car':null,sourceVehicleKind:post.carInfo?.carOrRelated||null});
  }
 }
 return byId;
}
export function attachHarajClassificationEvidence(listings,html){
 const evidence=harajClassificationEvidence(html);
 return listings.map(car=>{let id;try{id=new URL(car.url).pathname.split('/')[1];}catch{return car;}const hit=evidence.get(id);return hit?{...car,...hit,identityOrigin:'source-title'}:car;});
}
