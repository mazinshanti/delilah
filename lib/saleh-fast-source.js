import {extractSalehVehicleImage} from './saleh-image.js';

const UA='Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)';
const digits=s=>String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const norm=s=>digits(s).toLowerCase().normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
const strip=s=>String(s||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const CATALOG={
  corolla:{aliases:['corolla','كورولا','كرولا'],brand:['toyota','تويوتا'],urls:[
    'https://www.salehcars.com/en/cars/692d6d3f7763c76ddaf33a88/toyota-corolla-xli-2-0l-2026',
    'https://www.salehcars.com/en/cars/69b0a1b7845f71b9054ca65e/%D8%AA%D9%88%D9%8A%D9%88%D8%AA%D8%A7-%D9%83%D9%88%D8%B1%D9%88%D9%84%D8%A7-xli-1-5-%D9%85%D8%B7%D9%88%D8%B1-2026'
  ]},
  yaris:{aliases:['yaris','يارس'],brand:['toyota','تويوتا'],urls:[
    'https://www.salehcars.com/en/cars/68e275ca9f8dd76befd9616c/toyota-yaris-y-2026',
    'https://www.salehcars.com/en/cars/69a971ec6c4a6fc01fc27229/toyota-yaris-y-plus-2026'
  ]},
  rav4:{aliases:['rav4','rav 4','راف4','راف 4'],brand:['toyota','تويوتا'],urls:['https://www.salehcars.com/en/cars/69cbaefb2e54b13e4a815605/toyota-rav4-new-design-le-2026']},
  veloz:{aliases:['veloz','فيلوز'],brand:['toyota','تويوتا'],urls:['https://www.salehcars.com/en/cars/6a3a6554822b69eda62c07f2/toyota-veloz-glx-2026']},
  preface:{aliases:['preface','بريفيس','بريفايس'],brand:['geely','جيلي'],urls:['https://www.salehcars.com/en/cars/6809077c060e8546bf72d9c9/geely-preface-gf-2026']},
  eado:{aliases:['eado','ايدو','إيدو'],brand:['changan','شانجان'],urls:[
    'https://www.salehcars.com/en/cars/6834552fde57a1e7a9849757/changan-eado-plus-limited-2026',
    'https://www.salehcars.com/en/cars/68e23a0e9f8dd76bef375ce3/changan-eado-plus-smart-2026',
    'https://www.salehcars.com/en/cars/68347362de57a1e7a9b04b1e/changan-eado-plus-trend-2026'
  ]}
};
function detect(query=''){const q=norm(query),years=[...digits(query).matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));for(const [key,m] of Object.entries(CATALOG)){if(m.aliases.some(a=>q.includes(norm(a)))&&m.brand.some(a=>q.includes(norm(a))))return{key,...m,year:years.length===1?years[0]:null}}return null}
function priceFrom(text='',html=''){const vals=[];for(const m of digits(text).replace(/,/g,'').matchAll(/\b([1-9][0-9]{3,6})\s*(?:SAR|ر\.?س|ريال)\b/gi))vals.push(Number(m[1]));for(const m of digits(html).replace(/,/g,'').matchAll(/["'](?:price|cashPrice|salePrice|finalPrice|sellingPrice|discountedPrice)["']\s*:\s*["']?([1-9][0-9]{3,6})/gi))vals.push(Number(m[1]));const good=vals.filter(n=>n>=5000&&n<=2_000_000);return good.length?Math.min(...good):null}
async function fetchOne(url,meta,timeout){try{const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.9,ar;q=0.8'}});if(!r.ok)return null;const html=(await r.text()).slice(0,8_000_000),text=strip(html),h1=/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1],title=h1?strip(h1):text.slice(0,180),matchText=norm(`${title} ${decodeURIComponent(r.url||url)}`),years=[...digits(`${title} ${decodeURIComponent(r.url||url)}`).matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1])),year=years.find(y=>y>=2000&&y<=2035)||null;if(meta.year&&year!==meta.year)return null;if(!meta.aliases.some(a=>matchText.includes(norm(a))))return null;if(!meta.brand.some(a=>matchText.includes(norm(a))))return null;if(/not available|غير متوفر|نفدت الكمية/i.test(text)&&!/available upon request|متوفر عند الطلب/i.test(text))return null;const price=priceFrom(text.slice(0,5000),html),image=extractSalehVehicleImage(html,r.url||url,{title});return{source:'Saleh Cars',sourceType:'dealer',seller:'Saleh Cars',sourceStrict:true,title,snippet:text.slice(0,500),url:r.url||url,year,price,mileage:0,city:null,condition:'new',saleVerified:true,saleEvidence:['saleh_verified_fast_direct'],image:image||null,displayImage:image||null,imageVerified:Boolean(image),priceVerified:Boolean(price),priceSource:price?'saleh_direct_car_page':null,score:98,discovery:'saleh_fast_direct',fastSource:true}}catch{return null}}
export async function fetchSalehFast({query='',filters={},timeout=2200}={}){if(filters?.seller&&norm(filters.seller)!==norm('Saleh Cars'))return{listings:[],error:null};if(filters?.sourceType&&String(filters.sourceType)!=='dealer'&&String(filters.sourceType)!=='official_dealer')return{listings:[],error:null};const meta=detect(query);if(!meta)return{listings:[],error:'unsupported-fast-model'};const xs=(await Promise.all(meta.urls.map(url=>fetchOne(url,meta,timeout)))).filter(Boolean);return{listings:xs,error:null,model:meta.key}}
