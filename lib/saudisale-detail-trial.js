// Exact-ad HTML detail reader for the isolated market discovery trial.
import {cleanText,inventoryRecord} from './public-inventory.js';
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),m[2].replace(/&amp;/g,'&')]));
function identity(raw){try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname==='cars.saudisale.com'&&!u.username&&!u.password&&!u.port?u.pathname.match(/^\/(?:index\.php\/)?(?:en\/)?listings\/([a-zA-Z0-9]+)\/[^/]+\/?$/)?.[1]:null;}catch{return null;}}
const numeric=value=>{const s=String(value??'').replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\s*(?:km|كم)\s*$/i,'').trim();if(!/^\d+(?:,\d{3})*(?:\.\d+)?$/.test(s))return null;const n=Number(s.replace(/,/g,''));return Number.isFinite(n)&&n>=0?n:null;};
export function parseSaudiSaleDetail(html,candidate){
 if(candidate.source.id!=='saudisale')return [];
 const wanted=identity(candidate.url);if(!wanted)return [];
 const canonical=[...String(html).matchAll(/<link\b[^>]*>/gi)].map(m=>attrs(m[0])).find(a=>a.rel==='canonical')?.href;
 if(identity(canonical)!==wanted)return [];
 const marker=String(html).search(/<div\b[^>]*class=["'][^"']*\bcar-details1-container\b[^"']*["']/i);
 if(marker<0)return [];const end=html.indexOf('</ul>',marker);if(end<0)return [];
 const fields=new Map();
 for(const li of html.slice(marker,end).matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)){
  const spans=[...li[1].matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)].map(m=>cleanText(m[1]));
  if(spans.length===2&&!fields.has(spans[0]))fields.set(spans[0],spans[1]);
 }
 const get=(...names)=>names.map(n=>fields.get(n)).find(v=>v!=null);
 const title=cleanText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
 const pageTitle=cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
 const isNew=/\bNew\b|(?:^|\s)جديد(?:ة)?(?:\s|$)/i.test(pageTitle),isUsed=/\bUsed\b|(?:^|\s)مستعمل(?:ة)?(?:\s|$)/i.test(pageTitle);
 const condition=isNew===isUsed?null:isNew?'new':'used';if(!condition)return [];
 const make=get('Car Maker','المصنع'),model=get('Car Class','الفئة'),year=numeric(get('Year','السنة'));
 if(!title||!make||!model||!year)return [];
 const image=[...String(html).matchAll(/<meta\b[^>]*>/gi)].map(m=>attrs(m[0])).find(a=>a.property==='og:image')?.content;
 const record=inventoryRecord({url:canonical,title,make,model,year,condition,price:numeric(get('Price','السعر')),mileage:numeric(get('Mileage','المسافات المقطوعه','المسافات المقطوعة')),bodyType:get('Car Type','نوع السيارة')||null,transmission:get('Gear Type','نوع الجير')||null,trim:get('Car Model','الموديل')||null,image,sourceCategory:'cars'},candidate.source);
 return record?[record]:[];
}
