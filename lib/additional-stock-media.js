import sharp from 'sharp';
import {normalizeInventoryListing} from './inventory-normalizer.js';
const hosts={Mstaml:['img.mstaml.com'],Motory:['s3.eu-central-1.amazonaws.com'],'SAMACO Automotive':['s3-eu-west-1.amazonaws.com'],'ArabWheels Saudi':['cache1.arabwheels.sa','cache2.arabwheels.sa','cache3.arabwheels.sa','cache4.arabwheels.sa'],Kayishha:['ik.imagekit.io']};
// Source-bound image validation is performed once at ingestion, not on search requests.
export function stockMediaValidator(fetchImpl){
 const cache=new Map();
 async function check(url,source){try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts[source]?.includes(u.hostname))return null;
  const key=source+'|'+u.href;if(cache.has(key))return cache.get(key);
  const pending=(async()=>{try{const r=await fetchImpl(u.href,{redirect:'manual',signal:AbortSignal.timeout(15000)});if(!r.ok)return null;const reader=r.body?.getReader();if(!reader)return null;const chunks=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>5000000){await reader.cancel();return null;}chunks.push(Buffer.from(part.value));}const bytes=Buffer.concat(chunks);const m=await sharp(bytes,{limitInputPixels:40000000}).metadata();return ['jpeg','png','webp','avif','heif','gif'].includes(m.format)&&m.width>=480&&m.height>=240?{url:u.href,width:m.width,height:m.height}:null;}catch{return null;}})();cache.set(key,pending);return pending;
 }catch{return null;}}
 return async record=>{
  const verified=[];for(const url of [...new Set([record.image,...record.images||[]].filter(Boolean))].slice(0,3)){const result=await check(url,record.source);if(result)verified.push(result);}
  const images=verified.map(r=>r.url),image=images[0]||null;
  const missingFields=['trim','price','mileage','city','image'].filter(k=>(k==='image'?image:record[k])==null||(k==='image'?image:record[k])==='');
  return normalizeInventoryListing({...record,missingFields,dataComplete:missingFields.length===0,image,images,displayImage:image,primaryImage:image,primary_image:image,gallery_images:images,photos:[],media:{primaryImage:image,images},imageVerified:!!image,imageDimensions:verified[0]?{width:verified[0].width,height:verified[0].height}:null});
 };
}
