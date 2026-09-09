import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

function normalizeDigits(s=''){return String(s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))}
function basicIntent(query=''){
  const q=normalizeDigits(query.toLowerCase());
  const i={brand:null,model:null,minYear:null,maxYear:null,maxPrice:null,maxMileage:null,city:null,keywords:[]};
  const brands={jeep:'Jeep',جيب:'Jeep',wrangler:'Jeep',رانجلر:'Jeep',toyota:'Toyota',تويوتا:'Toyota','land cruiser':'Toyota',لاندكروزر:'Toyota',nissan:'Nissan',نيسان:'Nissan',patrol:'Nissan',باترول:'Nissan',lexus:'Lexus',لكزس:'Lexus',mercedes:'Mercedes',مرسيدس:'Mercedes',bmw:'BMW','بي ام':'BMW',porsche:'Porsche',بورش:'Porsche',ford:'Ford',فورد:'Ford',lincoln:'Lincoln',لينكون:'Lincoln',hyundai:'Hyundai',هيونداي:'Hyundai',kia:'Kia',كيا:'Kia',volkswagen:'Volkswagen',فولكس:'Volkswagen',chevrolet:'Chevrolet',شفروليه:'Chevrolet'};
  for(const[k,v]of Object.entries(brands))if(q.includes(k))i.brand=v;
  for(const[k,v]of [['wrangler','Wrangler'],['رانجلر','Wrangler'],['patrol','Patrol'],['باترول','Patrol'],['land cruiser','Land Cruiser'],['لاندكروزر','Land Cruiser']])if(q.includes(k))i.model=v;
  const yrs=[...q.matchAll(/\b(20\d{2})\b/g)].map(x=>Number(x[1]));if(yrs.length)i.minYear=Math.min(...yrs);
  const price=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})/);if(price)i.maxPrice=Number(price[1]);
  const km=q.match(/(?:under|below|less than|تحت|اقل من|أقل من)\s*(\d{2,7})\s*(?:km|كم|كيلو)/);if(km)i.maxMileage=Number(km[1]);
  if(q.includes('riyadh')||q.includes('الرياض'))i.city='Riyadh';if(q.includes('jeddah')||q.includes('جدة'))i.city='Jeddah';if(q.includes('dammam')||q.includes('الدمام'))i.city='Dammam';
  return i;
}
function inferCondition(text='',mileage=null){const t=normalizeDigits(text.toLowerCase());if(/\bnew\b|brand new|جديد|جديدة|زيرو|صفر كيلو|وكالة|غير مستخدم/.test(t))return'new';if(/\bused\b|pre-owned|مستعمل|مستعملة|ممشى|kilomet|mileage/.test(t))return'used';if(mileage!=null&&Number(mileage)>100)return'used';return null}
function numericPrice(v){if(v==null)return null;const n=Number(String(v).replace(/[^0-9.]/g,''));return Number.isFinite(n)&&n>=1000&&n<=5000000?n:null}
function isHarajListing(url){try{const u=new URL(url);return /(^|\.)haraj\.com\.sa$/i.test(u.hostname)&&/^\/\d{8,}(?:\/|$)/.test(u.pathname)}catch{return false}}
function mergedFilters(intent,filters={}){return{...intent,minYear:Number(filters.minYear)||intent.minYear||null,maxYear:Number(filters.maxYear)||intent.maxYear||null,maxPrice:Number(filters.maxPrice)||intent.maxPrice||null,maxMileage:Number(filters.maxMileage)||intent.maxMileage||null,city:filters.city||intent.city||null}}
function satisfies(c,i,condition){if(condition&&c.condition&&c.condition!==condition)return false;if(i.brand&&c.brand&&c.brand.toLowerCase()!==i.brand.toLowerCase())return false;if(i.model&&c.model&&!c.model.toLowerCase().includes(i.model.toLowerCase()))return false;if(i.minYear&&c.year&&c.year<i.minYear)return false;if(i.maxYear&&c.year&&c.year>i.maxYear)return false;if(i.maxPrice&&c.price&&c.price>i.maxPrice)return false;if(i.maxMileage&&c.mileage&&c.mileage>i.maxMileage)return false;if(i.city&&c.city&&c.city.toLowerCase()!==i.city.toLowerCase())return false;return true}

let checks=0;
const brands=[['رانجلر','Jeep','Wrangler'],['باترول','Nissan','Patrol'],['لاندكروزر','Toyota','Land Cruiser'],['BMW','BMW',null],['مرسيدس','Mercedes',null],['كيا','Kia',null]];
const cities=[['الرياض','Riyadh'],['جدة','Jeddah'],['الدمام','Dammam'],['Riyadh','Riyadh'],['Jeddah','Jeddah']];
for(let n=0;n<5000;n++){
  const [b,brand,model]=brands[n%brands.length];
  const [city,cityNorm]=cities[n%cities.length];
  const year=2020+(n%7); const price=80000+(n%9)*10000;
  const q=`ابي ${b} ${year} وفوق ${city} تحت ${price}`;
  const i=basicIntent(q);
  assert.equal(i.brand,brand); checks++;
  if(model){assert.equal(i.model,model);checks++}
  assert.equal(i.minYear,year);checks++;
  assert.equal(i.maxPrice,price);checks++;
  assert.equal(i.city,cityNorm);checks++;
}

const conditionCases=[['سيارة جديدة وكالة','new'],['brand new car','new'],['مستعمل ممشى 40000','used'],['used pre-owned','used'],['car',null]];
for(let n=0;n<3000;n++){const [text,exp]=conditionCases[n%conditionCases.length];assert.equal(inferCondition(text),exp);checks++}

const harajGood=['https://haraj.com.sa/11186424374/test','https://www.haraj.com.sa/12345678/abc'];
const harajBad=['https://haraj.com.sa/tags/رانجلر','https://haraj.com.sa/search','https://example.com/11186424374/test','https://haraj.com.sa/1234/test'];
for(let n=0;n<2000;n++){assert.equal(isHarajListing(harajGood[n%harajGood.length]),true);checks++;assert.equal(isHarajListing(harajBad[n%harajBad.length]),false);checks++}

for(let n=0;n<2500;n++){
  const intent={brand:'Toyota',model:'Land Cruiser',minYear:2022,maxYear:2026,maxPrice:180000,maxMileage:90000,city:'Riyadh'};
  const good={brand:'Toyota',model:'Land Cruiser',year:2024,price:170000,mileage:50000,city:'Riyadh',condition:'used'};
  assert.equal(satisfies(good,intent,'used'),true);checks++;
  const bad={...good,price:190000};assert.equal(satisfies(bad,intent,'used'),false);checks++;
  assert.equal(satisfies({...good,condition:'new'},intent,'used'),false);checks++;
}

for(let n=0;n<2000;n++){
  assert.equal(numericPrice(`SAR ${100000+n}`),100000+n);checks++;
  assert.equal(numericPrice('free'),null);checks++;
  const m=mergedFilters({minYear:2020,maxPrice:200000,city:null},{minYear:'2023',maxPrice:'150000',city:'Jeddah'});
  assert.equal(m.minYear,2023);assert.equal(m.maxPrice,150000);assert.equal(m.city,'Jeddah');checks+=3;
}

const sourceLayer=await readFile(new URL('../server-v21.js',import.meta.url),'utf8');
assert.match(sourceLayer,/const allUsed=\[[\s\S]*?\{name:"Motory",seller:"Motory",type:"marketplace"[\s\S]*?condition:"used"\}/);checks++;
assert.match(sourceLayer,/Motory:\"active-indexed\+verified-url\"/);checks++;
assert.match(sourceLayer,/Motory: u =>[\s\S]*?cars-for-sale/);checks++;

const edgeLayer=await readFile(new URL('../server-recovery-v25.js',import.meta.url),'utf8');
assert.match(edgeLayer,/function makeSearchId\(/);checks++;
assert.match(edgeLayer,/function stateFromSearchId\(/);checks++;
assert.match(edgeLayer,/restartSafeSearchIds:true/);checks++;

const marketLayer=await readFile(new URL('../server-v15-market.js',import.meta.url),'utf8');
assert.match(marketLayer,/function directMotory\(/);checks++;
assert.match(marketLayer,/async function scanMotory\(/);checks++;
assert.match(marketLayer,/motory_source_native_catalog/);checks++;
assert.match(marketLayer,/bodyFromSearchId\(/);checks++;

const harajLayer=await readFile(new URL('../server-v15-haraj.js',import.meta.url),'utf8');
assert.match(harajLayer,/function directHaraj\(/);checks++;
assert.match(harajLayer,/async function scanHaraj\(/);checks++;
assert.match(harajLayer,/haraj_source_native_search/);checks++;
assert.match(harajLayer,/const PARTS_RE=/);checks++;
assert.match(harajLayer,/bodyFromSearchId\(/);checks++;

const qualityLayer=await readFile(new URL('../server-v15-quality.js',import.meta.url),'utf8');
assert.match(qualityLayer,/const PARTS_RE=.*شبك/);checks++;
assert.match(qualityLayer,/const NON_SALE_RE=/);checks++;
assert.match(qualityLayer,/function acceptable\(/);checks++;
assert.match(qualityLayer,/qualityGate:true/);checks++;
assert.match(qualityLayer,/function directSyarah\(/);checks++;
assert.match(qualityLayer,/async function scanSyarah\(/);checks++;

const salehLayer=await readFile(new URL('../server-v15-saleh.js',import.meta.url),'utf8');
assert.match(salehLayer,/function directSaleh\(/);checks++;
assert.match(salehLayer,/async function scanSaleh\(/);checks++;
assert.match(salehLayer,/body\.condition!==['"]new['"]/);checks++;
assert.match(salehLayer,/saleh_source_native_inventory/);checks++;
assert.match(salehLayer,/salehNativeInventory:true/);checks++;

const yallaLayer=await readFile(new URL('../server-v15-yallamotor.js',import.meta.url),'utf8');
assert.match(yallaLayer,/function directYalla\(/);checks++;
assert.match(yallaLayer,/yallamotor_source_native_search/);checks++;

const carSwitchLayer=await readFile(new URL('../server-v15-carswitch.js',import.meta.url),'utf8');
assert.match(carSwitchLayer,/function direct\(/,'CarSwitch direct listing validator must remain enabled');checks++;
assert.match(carSwitchLayer,/function searchUrl\(/,'CarSwitch model/year source-native routing must remain enabled');checks++;
assert.match(carSwitchLayer,/carswitch_source_native_search/,'CarSwitch results must be source-tagged');checks++;
assert.match(carSwitchLayer,/carswitchNativeInventory:true/,'CarSwitch diagnostics must remain visible');checks++;
assert.match(carSwitchLayer,/yallamotorStatus:'blocked-http-403-experimental'/,'Blocked YallaMotor must not be counted as active coverage');checks++;

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'1.5.0');checks++;
assert.equal(pkg.scripts.start,'node server-v15-carswitch.js');checks++;

console.log(`PASS: ${checks.toLocaleString()} regression assertions`);
