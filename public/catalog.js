import {VEHICLE_CATALOG} from './vehicle-catalog-data.js';
export {VEHICLE_CATALOG};
export const catalogText=value=>String(value??'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim().replace(/\s+/g,' ');
const normalized=new Map();const cachedText=v=>{if(normalized.has(v))return normalized.get(v);const out=catalogText(v);if(normalized.size>12000)normalized.clear();normalized.set(v,out);return out;};
const contains=(text,alias)=>` ${cachedText(text)} `.includes(` ${cachedText(alias)} `);
const makeAliases=VEHICLE_CATALOG.makes.flatMap(make=>make.aliases.map(alias=>({make,alias}))).sort((a,b)=>b.alias.length-a.alias.length);
const modelEntries=VEHICLE_CATALOG.makes.flatMap(make=>make.models.map(model=>({make,model})));
export function catalogMake(query){const hay=` ${cachedText(query)} `;return makeAliases.map(x=>({...x,index:hay.indexOf(` ${cachedText(x.alias)} `)})).filter(x=>x.index>=0).sort((a,b)=>a.index-b.index||b.alias.length-a.alias.length)[0]?.make||null;}
const intents=new Map();
export function catalogIntent(query){
 if(intents.has(query))return intents.get(query);
 const make=catalogMake(query),hay=catalogText(query),pool=make?modelEntries.filter(x=>x.make===make):modelEntries;
 const matches=pool.flatMap(x=>x.model.aliases.filter(a=>contains(hay,a)&&(make||catalogText(a).length>3&&!/^\d+$/.test(a))).map(alias=>({...x,alias}))).sort((a,b)=>catalogText(b.alias).length-catalogText(a.alias).length);
 const prefix=make?.aliases.map(catalogText).sort((a,b)=>b.length-a.length).find(a=>hay.startsWith(a+' '));
 const remainder=prefix?hay.slice(prefix.length).trim():hay;
 const canonical=make?pool.filter(x=>remainder===catalogText(x.model.name)||remainder.startsWith(catalogText(x.model.name)+' ')).sort((a,b)=>b.model.name.length-a.model.name.length)[0]:null;
 let best=canonical?{...canonical,alias:canonical.model.name}:matches[0];
 if(best&&!make&&matches.some(x=>catalogText(x.alias)===catalogText(best.alias)&&x.make!==best.make))best=null;
 if(best&&/^(19|20)\d{2}$/.test(best.alias)&&!hay.startsWith(catalogText(best.make.name)+' '+best.alias))best=null;
 const result={make:make?.name||best?.make.name||null,model:best?.model.name||null,known:Boolean(best),modelKey:best?`${best.make.name}::${best.model.name}`:null};if(intents.size>5000)intents.clear();intents.set(query,result);return result;
}
export function catalogModelMatches(car,key){
 const [makeName,modelName]=String(key).split('::'),make=VEHICLE_CATALOG.makes.find(x=>x.name===makeName),model=make?.models.find(x=>x.name===modelName);if(!model)return false;
 const declared=catalogMake(car.make||car.brand||'');if(declared&&declared.name!==makeName)return false;
 const candidate=car.model?catalogIntent(`${makeName} ${car.model}`):null;if(candidate?.model&&candidate.model!==modelName)return false;
 const text=[car.model,car.title,car.url,car.originalUrl].filter(Boolean).join(' ');
 return model.aliases.some(alias=>contains(text,alias));
}
export const catalogLabel=(name,lang='ar')=>lang==='ar'?(VEHICLE_CATALOG.makes.find(m=>m.name===name)?.ar||name):name;
