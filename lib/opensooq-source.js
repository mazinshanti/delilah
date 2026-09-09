const BASE='https://sa.opensooq.com';
const UA='Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)';
const BAD=/(?:قطع\s*غيار|مكين[هة]|محرك|ايرباق|ارباق|طبلون|كمبروسر|دينمو|رديتر|صدام|شبك|شمعة|شمعات|انوار|أنوار|رفرف|كبوت|جنط|جنوط|كفرات|فلتر|طرمب[هة]|حساس|اصطب|اسطب|كشاف|مراي[هة]|مرآة|تشليح|للتشليح|للايجار|للإيجار|تاجير|تأجير|ورشة|صيانة)/i;
const digits=s=>String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const norm=s=>digits(s).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const MODEL_ALIASES={
 corolla:['corolla','كورولا','كرولا'],camry:['camry','كامري','كامرى'],yaris:['yaris','يارس'],patrol:['patrol','باترول'],sunny:['sunny','صني'],wrangler:['wrangler','رانجلر'],
 tucson:['tucson','توسان'],elantra:['elantra','النترا','إلنترا'],sonata:['sonata','سوناتا'],sportage:['sportage','سبورتاج'],tahoe:['tahoe','تاهو'],'land cruiser':['land cruiser','لاند كروزر','لاندكروزر'],
 prado:['prado','برادو'],fortuner:['fortuner','فورتشنر'],accent:['accent','اكسنت','أكسنت'],altima:['altima','التيما','ألتيما'],x5:['x5'],rx:['lexus rx','rx'],es:['lexus es','es']
};
const BRAND_ALIASES={toyota:['toyota','تويوتا'],nissan:['nissan','نيسان'],jeep:['jeep','جيب'],hyundai:['hyundai','هيونداي'],kia:['kia','كيا'],chevrolet:['chevrolet','شفروليه'],ford:['ford','فورد'],lexus:['lexus','لكزس'],bmw:['bmw','بي ام دبليو'],mercedes:['mercedes','مرسيدس']};
function direct(url=''){try{const u=new URL(url);return u.hostname==='sa.opensooq.com'&&/^\/en\/search\/\d{6,}\/?$/i.test(u.pathname)}catch{return false}}
function yearOf(s=''){const m=digits(s).match(/\b((?:19|20)\d{2})\b/);return m?Number(m[1]):null}
function mileageOf(s=''){const t=digits(s).replace(/,/g,'');const m=t.match(/\b([1-9][0-9]{2,6})\s*(?:km|كلم|كم)\b/i)||t.match(/(?:mileage|الممشى|ممشى)\s*[:：]?\s*([1-9][0-9]{2,6})/i);return m?Number(m[1]):null}
function imgOf(item){return item?.image?.url||item?.image||null}
function cityOf(item){return item?.offers?.areaServed?.address?.addressRegion||item?.offers?.areaServed?.address?.addressLocality||null}
function parseScripts(html=''){
 const out=[];
 for(const m of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{out.push(JSON.parse(m[1]))}catch{}
 }
 return out;
}
function vehicleItems(doc){const graphs=[];if(Array.isArray(doc?.['@graph']))graphs.push(...doc['@graph']);if(Array.isArray(doc))graphs.push(...doc);else graphs.push(doc);const out=[];for(const g of graphs){if(g?.['@type']==='ItemList'&&Array.isArray(g.itemListElement)){for(const row of g.itemListElement){const item=row?.item;if(item?.['@type']==='Vehicle')out.push(item)}}}return out}
export function parseOpenSooqPage(html='',opts={}){
 const listings=[],seen=new Set();for(const doc of parseScripts(html))for(const item of vehicleItems(doc)){
  const url=String(item.url||'');if(!direct(url)||seen.has(url))continue;
  const title=String(item.name||'').trim(),description=String(item.description||'').trim(),text=`${title} ${description}`;if(!title||BAD.test(title))continue;
  const year=yearOf(title)||yearOf(description),price=Number(item?.offers?.price)||null,condition=/NewCondition/i.test(String(item.itemCondition||''))?'new':'used';
  const f=opts.filters||{};if(opts.condition&&condition!==opts.condition)continue;if(f.minYear&&(!year||year<Number(f.minYear)))continue;if(f.maxYear&&(!year||year>Number(f.maxYear)))continue;if(f.maxPrice&&price!=null&&price>Number(f.maxPrice))continue;
  const city=cityOf(item);if(f.city&&norm(city||'')!==norm(f.city))continue;if(f.maxMileage){const km=mileageOf(text);if(km!=null&&km>Number(f.maxMileage))continue}
  const q=norm(opts.query||'');if(q){const model=Object.entries(MODEL_ALIASES).find(([,a])=>a.some(x=>q.includes(norm(x))))?.[0]||null;const brand=Object.entries(BRAND_ALIASES).find(([,a])=>a.some(x=>q.includes(norm(x))))?.[0]||null;if(model&&!MODEL_ALIASES[model].some(x=>norm(text).includes(norm(x))))continue;if(brand&&!BRAND_ALIASES[brand].some(x=>norm(text).includes(norm(x))))continue;const exact=yearOf(opts.query);if(exact&&year!==exact)continue}
  seen.add(url);listings.push({source:'OpenSooq',sourceType:'marketplace',seller:'OpenSooq',sourceStrict:true,title,snippet:description.slice(0,550),url,year,price,mileage:mileageOf(text),city,condition,image:imgOf(item),displayImage:imgOf(item),imageVerified:Boolean(imgOf(item)),priceVerified:Boolean(price),saleVerified:true,saleEvidence:['opensooq_jsonld_vehicle','opensooq_direct_search_url'],score:91,discovery:'opensooq_structured_itemlist'});
 }
 return listings;
}
export async function fetchOpenSooqPage(url,{timeout=12000}={}){const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.9,ar;q=0.8'}});if(!r.ok)throw new Error(`OpenSooq HTTP ${r.status}`);return{html:await r.text(),url:r.url||url,status:r.status}}
export async function fetchOpenSooqUsed({pages=3,query='',filters={}}={}){const out=[],seen=new Set(),errors=[];for(let p=1;p<=pages;p++){const url=`${BASE}/en/cars/cars-for-sale/used${p>1?`?page=${p}`:''}`;try{const d=await fetchOpenSooqPage(url);for(const x of parseOpenSooqPage(d.html,{condition:'used',query,filters})){if(!seen.has(x.url)){seen.add(x.url);out.push(x)}}}catch(e){errors.push({page:p,error:e?.message||String(e)})}}return{listings:out,errors,pagesAttempted:pages}}
export async function verifyOpenSooqDirect(url){if(!direct(url))return{ok:false,error:'not_direct'};try{const d=await fetchOpenSooqPage(url);const title=/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(d.html)?.[1]?.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()||null;return{ok:true,status:d.status,url:d.url,title,bytes:d.html.length}}catch(e){return{ok:false,error:e?.message||String(e)}}}
