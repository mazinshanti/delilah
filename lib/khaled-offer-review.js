// Isolated evidence review. Dealer product offers never become inventory here.
import {cleanText} from './public-inventory.js';
import {classifyVehicle} from './vehicle-classification.js';
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),m[2].replace(/&amp;/g,'&')]));
export function khaledOfferIdentity(raw){
 try{const u=new URL(raw);if(u.protocol!=='https:'||u.hostname!=='khaledcars.com'||u.username||u.password||u.port)return null;
 return u.pathname.match(/^\/(?:ar|en)\/car\/[^/]+\/(\d+)\/?$/)?.[1]||null;}catch{return null;}
}
const numeric=v=>/^\d+(?:,\d{3})*(?:\.\d+)?$/.test(String(v))?Number(String(v).replace(/,/g,'')):null;
export function reviewKhaledOffer({url,html,status=200}){
 const reject=reason=>({status:reason,offer:null,acceptedVehicles:0});
 if(status!==200)return reject(`HTTP ${status}`);
 const id=khaledOfferIdentity(url);if(!id)return reject('unsupported-source-url');
 const main=String(html).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];if(!main)return reject('missing-detail-panel');
 // Stop before recommendations, which repeat h1, prices, fields and photos.
 const related=main.search(/<h3\b[^>]*>\s*(?:سيارات ذات صلة|Related Cars|Related Vehicles)\s*<\/h3>/i);
 if(related<0)return reject('unknown-page-layout');
 const panel=main.slice(0,related),title=cleanText(panel.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
 const purchase=[...panel.matchAll(/<a\b[^>]*>/gi)].some(m=>{try{const u=new URL(attrs(m[0]).href);return u.origin==='https://khaledcars.com'&&/^\/(?:ar|en)\/request\/individual$/.test(u.pathname)&&u.searchParams.get('car')===id;}catch{return false;}});
 if(!title||!purchase)return reject('missing-exact-offer-binding');
 const cars=[];for(const m of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const car=JSON.parse(m[1]);if(car['@type']==='Car')cars.push(car);}catch{}}
 if(cars.length!==1||cleanText(cars[0].name)!==title)return reject('conflicting-vehicle-evidence');
 const car=cars[0],fields=new Map();
 if([car.url,car.offers?.url].some(raw=>raw&&khaledOfferIdentity(raw)!==id))return reject('conflicting-offer-url');
 for(const m of panel.matchAll(/<span\b[^>]*>([^<]*)<\/span>\s*<span\b[^>]*>([^<]*)<\/span>/gi)){
  const key=cleanText(m[1]),value=cleanText(m[2]);if(fields.has(key)&&fields.get(key)!==value)return reject('conflicting-specification');fields.set(key,value);
 }
 const get=(...keys)=>keys.map(k=>fields.get(k)).find(v=>v!=null)||null;
 const year=numeric(get('سنة الصنع','Year','Manufacturing Year'));
 const titleYear=title.match(/\b((?:19|20)\d{2})\b/)?.[1];
 if(!year||year<1980||year>new Date().getFullYear()+1||(titleYear&&Number(titleYear)!==year))return reject('missing-or-conflicting-year');
 const verdict=classifyVehicle({url,title,make:car.brand?.name,schemaType:'Car',year});
 if(verdict.classification!=='VEHICLE_FOR_SALE'||!verdict.identity.make||!verdict.identity.model)return reject('vehicle-boundary');
 const odometer=get('المسافة المقطوعة','Mileage');
 const condition=/^(?:جديد|جديدة|new)$/i.test(odometer||'')?'new':/^(?:مستعمل|مستعملة|used)$/i.test(odometer||'')?'used':null;
 const galleryStart=panel.search(/<div\b[^>]*class=["'][^"']*\bmainSwiper\b/i);
 const galleryEnd=panel.indexOf('<h1',galleryStart);
 const gallery=galleryStart>=0&&galleryEnd>galleryStart?panel.slice(galleryStart,galleryEnd):'';
 const images=[...new Set([...gallery.matchAll(/<img\b[^>]*>/gi)].map(m=>attrs(m[0]).src).filter(raw=>{try{const u=new URL(raw);return u.origin==='https://khaledcars.com'&&!u.username&&!u.password&&/^\/admin\/images\/uploads\/[^/]+\.(?:webp|jpe?g|png)$/i.test(u.pathname);}catch{return false;}}))];
 const starting=/السعر يبدأ من|price starts from|starting from/i.test(cleanText(panel));
 const amount=car.offers?.priceCurrency==='SAR'?numeric(car.offers.price):null;
 const visibleAmount=amount!=null&&[...panel.matchAll(/<span\b[^>]*>([^<]*)<\/span>/gi)].some(m=>numeric(cleanText(m[1]))===amount);
 const startPrice=starting&&visibleAmount&&amount>0?amount:null;
 const evidence=[{field:'identity',origin:'Car JSON-LD + primary h1 + purchase ID',value:{title,id}},{field:'year',origin:'primary specification panel',value:year}];
 if(condition)evidence.push({field:'condition',origin:'المسافة المقطوعة / Mileage',value:odometer});
 if(startPrice)evidence.push({field:'startingPriceSar',origin:'visible starting-price label + matching SAR Offer',value:startPrice});
 const specs={fuelType:get('نوع المحرك','Fuel Type','Engine Type'),transmission:get('ناقل الحركة','Transmission'),bodyType:get('نوع الهيكل','Body Type'),drivetrain:get('نوع الجر','Drivetrain','Drive Type'),engineRaw:get('حجم المحرك','Engine Size')};
 for(const [field,value] of Object.entries(specs))if(value)evidence.push({field,origin:'primary specification panel',value});
 return {status:'dealer-offer-review',acceptedVehicles:0,offer:{source:'Khaled Cars',sourceListingId:`khaledcars:${id}`,originalUrl:url,title,make:verdict.identity.make,model:verdict.identity.model,year,condition,mileage:null,trim:null,...specs,priceSar:null,startingPriceSar:startPrice,priceType:startPrice?'starting':null,vatIncluded:null,availability:car.offers?.availability||null,stockVerified:false,images,imageHttpVerified:false,evidence}};
}
