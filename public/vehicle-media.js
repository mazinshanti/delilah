function imageQuality(url,index){
 const u=new URL(url),text=`${u.pathname} ${u.search}`.toLowerCase();let score=1000-index;
 if(/(?:original|full|large|xlarge|high[-_]?res|gallery)/.test(text))score+=500;
 if(/(?:thumb|thumbnail|tiny|small|preview|icon|avatar|logo|placeholder)/.test(text))score-=700;
 const dimensions=[];
 const width=Number(u.searchParams.get('w')||u.searchParams.get('width'));
 const height=Number(u.searchParams.get('h')||u.searchParams.get('height'));
 if(width>0&&height>0)dimensions.push(width*height);else if(width>0)dimensions.push(width*width);
 const area=Math.max(0,...dimensions);if(area)score+=Math.min(600,area/4000);if(area&&area<120000)score-=800;
 return score;
}
export function imageUrls(...values){const out=[],seen=new Set();function add(v){if(Array.isArray(v)){v.forEach(add);return;}if(v&&typeof v==='object'){add(v.url||v.contentUrl||v.src);return;}if(typeof v!=='string'||!v.trim())return;try{const u=new URL(v);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return;u.hash='';if(!seen.has(u.href)){seen.add(u.href);out.push(u.href);}}catch{}}values.forEach(add);return out.map((url,index)=>({url,index,score:imageQuality(url,index)})).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.url).slice(0,40);}
export function vehicleImages(car={}){return imageUrls(car.images,car.media?.images,car.photos,car.primaryImage,car.image,car.displayImage);}
export function withGallery(car,images){const gallery=imageUrls(images);return{...car,images:gallery,image:gallery[0]||null,displayImage:gallery[0]||null,media:{...(car.media||{}),primaryImage:gallery[0]||null,images:gallery}};}
