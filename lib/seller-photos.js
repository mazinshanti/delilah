import sharp from 'sharp';
import {createHash} from 'node:crypto';
export async function prepareSellerPhotos(photos=[]){
 if(!Array.isArray(photos)||photos.length>10)throw Error('invalid-photos');
 const out=[],seen=new Set();let total=0;
 for(const photo of photos){
  if(!photo||typeof photo.data!=='string'||photo.data.length>2800000)throw Error('photo-too-large');
  const match=photo.data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)throw Error('invalid-photo-type');
  const input=Buffer.from(match[2],'base64');total+=input.length;if(input.length>2000000||total>8000000)throw Error('photo-too-large');
  const source=sharp(input,{limitInputPixels:24000000,failOn:'error'}),meta=await source.metadata();if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1||!meta.width||!meta.height)throw Error('invalid-photo');
  const data=await source.rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
  const hash=createHash('sha256').update(data).digest('hex');if(seen.has(hash))continue;seen.add(hash);
  const image=await sharp(data).metadata();out.push({data,hash,mime:'image/webp',width:image.width,height:image.height});
 }
 return out;
}
