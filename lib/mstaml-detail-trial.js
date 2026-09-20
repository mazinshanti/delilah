// Saudi individual classified ads only. Category products and related ads are not stock.
import {cleanText,inventoryRecord} from './public-inventory.js';
import {catalogIntent} from '../public/catalog.js';
import {extractMileage} from './vehicle-mileage.js';
export const MSTAML_TRIAL_SOURCE={id:'mstaml',name:'Mstaml',url:'https://www.mstaml.com/',type:'classifieds',status:'trial-only',detailPattern:/^\/sa\/product\/[^?#]+$/};
export function mstamlIdentity(raw){
 try{const u=new URL(String(raw).replace(/&amp;/g,'&'));if(u.protocol!=='https:'||u.hostname!=='www.mstaml.com'||u.username||u.password||u.port||!MSTAML_TRIAL_SOURCE.detailPattern.test(u.pathname))return null;
 const ids=u.searchParams.getAll('id');return ids.length===1&&/^\d{6,10}$/.test(ids[0])?ids[0]:null;}catch{return null;}
}
const text=s=>cleanText(String(s??'').replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi,'')).replace(/&nbsp;/g,' ').trim();
const number=s=>/^\d+(?:,\d{3})*(?:\.\d+)?$/.test(String(s??''))?Number(String(s).replace(/,/g,'')):null;
export function parseMstamlDetail(html,candidate){
 const fail=reason=>({records:[],reason});const id=mstamlIdentity(candidate.url);if(!id)return fail('unsupported-source-url');
 const primary=String(html).split(/إعلانات مشابهة|سيارات من المزاد/)[0];
 const title=text(primary.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
 const products=[];
 for(const m of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const root=JSON.parse(m[1]);if(root['@type']==='WebPage'&&root.mainEntity?.['@type']==='Product')products.push(root.mainEntity);}catch{}
 }
 if(products.length!==1)return fail('missing-exact-product');const p=products[0];
 if(String(p.sku)!==id||mstamlIdentity(p.offers?.url)!==id||text(p.name)!==title)return fail('conflicting-ad-identity');
 if(p.category!=='سيارات ومركبات/سيارة جديدة أو مستعملة')return fail('vehicle-category-required');
 if(!/\/InStock$/.test(p.offers?.availability||'')||p.offers?.priceCurrency!=='SAR')return fail('saudi-available-offer-required');
 const fields=new Map();
 for(const m of primary.matchAll(/<tr\b[^>]*>[\s\S]*?<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi)){
  const key=text(m[1]).replace(/[:：]\s*$/,'').trim(),value=text(m[2]);if(fields.has(key)&&fields.get(key)!==value)return fail('conflicting-specification');fields.set(key,value);
 }
 if(fields.get('نوع الإعلان')!=='للبيع')return fail('sale-evidence-required');
 const condition=({'مستعملة':'used','مستعمل':'used','جديدة':'new','جديد':'new'})[fields.get('حالة السيارة')]||null;
 const identity=catalogIntent(title);const years=[...title.matchAll(/\b((?:19|20)\d{2})\b/g)].map(m=>Number(m[1]));
 if(!identity.make||!identity.model||new Set(years).size!==1)return fail('unresolved-vehicle-identity');
 const year=years[0];if(/^\d{4}$/.test(String(p.model))&&Number(p.model)!==year)return fail('conflicting-year');
 const description=text(p.description),labelMileage=number(fields.get('ممشى السيارة بالكيلو متر')),descriptionMileage=extractMileage(description);
 const mileageEvidenceConflict=labelMileage!==null&&descriptionMileage!==null&&labelMileage!==descriptionMileage;
 const mileage=mileageEvidenceConflict?null:labelMileage??descriptionMileage;
 if(condition==='new'&&(labelMileage>100||descriptionMileage>100||/مستعمل[ةه]?|\bused\b/i.test(description)))return fail('conflicting-condition');
 const bidding=/على السوم|لل?سوم|مزاد|auction|monthly|شهري|قسط/i.test(description);
 const price=bidding?null:number(p.offers.price);
 const images=[...new Set((Array.isArray(p.image)?p.image:[]).map(i=>i.contentUrl||i.url).filter(raw=>{try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname==='img.mstaml.com'&&!u.username&&!u.password&&!u.port&&/^\/i\d+\//.test(u.pathname);}catch{return false;}}))];
 const record=inventoryRecord({url:candidate.url,title,description,schemaType:'Car',sourceCategory:p.category,make:identity.make,model:identity.model,year,condition,price,mileage,mileageEvidenceConflict,city:null,image:images[0]||null,images,transmission:fields.get('نوع القير')||null,fuelType:fields.get('نوع المحرك')||null,trim:fields.get('فئة السيارة')||null},MSTAML_TRIAL_SOURCE);
 return {records:record?[record]:[],reason:record?null:'vehicle-boundary'};
}
