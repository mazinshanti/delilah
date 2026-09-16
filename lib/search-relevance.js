import {VEHICLE_CATALOG,catalogMake} from '../public/catalog.js';
const digits = value => String(value ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

export function normalizeSearchText(value = '') {
  return digits(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const BRAND_GROUPS = {
  FAW:['faw','فاو'],
  Fiat:['fiat','فيات'],
  BAW:['baw','باو'],
  JAC:['jac','جاك'],
  Chery:['chery','شيري'],
  BAIC:['baic','بايك'],
  Maxus:['maxus','ماكسوس'],
  'Great Wall':['great wall','gwm','جريت وول'],
  Tank:['tank','تانك'],
  Foton:['foton','فوتون'],
  JMC:['jmc','جي ام سي التجارية'],
  Soueast:['soueast','ساوايست'],
  Toyota: ['toyota','تويوتا'],
  Lexus: ['lexus','لكزس'],
  Nissan: ['nissan','نيسان'],
  Infiniti: ['infiniti','انفينيتي','إنفينيتي'],
  Honda: ['honda','هوندا'],
  Mazda: ['mazda','مازدا'],
  Mitsubishi: ['mitsubishi','ميتسوبيشي'],
  Subaru: ['subaru','سوبارو'],
  Suzuki: ['suzuki','سوزوكي'],
  Isuzu: ['isuzu','ايسوزو','إيسوزو'],
  Hyundai: ['hyundai','هيونداي','هونداي'],
  Genesis: ['genesis','جينيسس','جينسس'],
  Kia: ['kia','كيا'],
  Ford: ['ford','فورد'],
  Lincoln: ['lincoln','لينكولن'],
  Chevrolet: ['chevrolet','chevy','شفروليه','شيفروليه'],
  GMC: ['gmc','جي ام سي','جمس'],
  Cadillac: ['cadillac','كاديلاك'],
  Jeep: ['jeep','جيب'],
  Dodge: ['dodge','دودج'],
  Ram: ['ram','رام'],
  Chrysler: ['chrysler','كرايسلر'],
  BMW: ['bmw','بي ام دبليو','بي ام'],
  Mercedes: ['mercedes','mercedes benz','مرسيدس','مرسيدس بنز'],
  Audi: ['audi','اودي','أودي'],
  Volkswagen: ['volkswagen','vw','فولكس واجن','فولكس فاجن'],
  Porsche: ['porsche','بورش'],
  MINI: ['mini','ميني'],
  Volvo: ['volvo','فولفو'],
  'Land Rover': ['land rover','range rover','لاند روفر','رينج روفر'],
  Jaguar: ['jaguar','جاكوار'],
  Bentley: ['bentley','bently','bentely','بنتلي','بنتلى'],
  'Rolls-Royce': ['rolls royce','rolls-royce','رولز رويس','رولزرويس'],
  Ferrari: ['ferrari','فيراري'],
  Lamborghini: ['lamborghini','لامبورغيني','لامبورجيني'],
  Maserati: ['maserati','مازيراتي'],
  'Aston Martin': ['aston martin','استون مارتن','أستون مارتن'],
  McLaren: ['mclaren','ماكلارين'],
  Tesla: ['tesla','تسلا'],
  Lucid: ['lucid','لوسيد'],
  Renault: ['renault','رينو'],
  Peugeot: ['peugeot','بيجو'],
  Citroen: ['citroen','citroën','سيتروين'],
  Skoda: ['skoda','سكودا'],
  MG: ['mg','ام جي','إم جي'],
  Geely: ['geely','جيلي'],
  Changan: ['changan','شانجان'],
  Haval: ['haval','هافال'],
  GAC: ['gac','جي ايه سي','جي اي سي'],
  BYD: ['byd','بي واي دي'],
  Jetour: ['jetour','جيتور'],
  Exeed: ['exeed','اكسيد','إكسيد'],
  Hongqi: ['hongqi','هونشي'],
  Zeekr: ['zeekr','زيكر'],
  'Lynk & Co': ['lynk co','lynk & co','لينك اند كو'],
  Polestar: ['polestar','بولستار'],
  Omoda: ['omoda','اومودا','أومودا'],
  Jaecoo: ['jaecoo','جايكو']
};

for(const make of VEHICLE_CATALOG.makes)BRAND_GROUPS[make.name]=[...new Set([...(BRAND_GROUPS[make.name]||[]),...make.aliases])];
const QUERY_CORRECTIONS = [
  {canonical:'Bentley',aliases:['bently','bentely','بنتلى']}
];

export function canonicalizeVehicleQuery(value = '') {
  let query=String(value??'');
  const corrections=[];
  for(const {canonical,aliases} of QUERY_CORRECTIONS){
    for(const alias of aliases){
      const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const re=new RegExp(`(^|[^a-zA-Z0-9\\u0600-\\u06ff])${escaped}(?=$|[^a-zA-Z0-9\\u0600-\\u06ff])`,'ig');
      if(!re.test(query))continue;
      query=query.replace(re,(_match,before)=>`${before}${canonical}`);
      corrections.push({from:alias,to:canonical,type:'typo'});
    }
  }
  return {query:query.replace(/\s+/g,' ').trim(),corrections};
}

const BRAND_ALIASES=Object.entries(BRAND_GROUPS).map(([brand,aliases])=>[brand,aliases.map(a=>` ${normalizeSearchText(a)} `)]);
const brandCache=new Map();
export function detectRequestedBrand(query=''){
 const q=normalizeSearchText(query);if(!q)return null;
 if(brandCache.has(q))return brandCache.get(q);
 const hay=` ${q} `,brand=catalogMake(query)?.name||BRAND_ALIASES.find(([,aliases])=>aliases.some(a=>hay.includes(a)))?.[0]||null;
 if(brandCache.size>5000)brandCache.clear();brandCache.set(q,brand);return brand;
}
export function listingMatchesBrand(car={},brand=null){
 if(!brand)return true;
 const hay=` ${normalizeSearchText([car.brand,car.make,car.manufacturer,car.title,car.snippet,car.url,car.originalUrl].filter(Boolean).join(' '))} `;
 return (BRAND_GROUPS[brand]||[brand]).some(alias=>hay.includes(` ${normalizeSearchText(alias)} `));
}

export function filterBrandRelevance(listings = [], query = '') {
  const brand = detectRequestedBrand(query);
  const input = Array.isArray(listings) ? listings : [];
  if (!brand) return input;
  return input.filter(car => listingMatchesBrand(car, brand));
}
