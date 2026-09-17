import {catalogIntent,catalogMake,catalogText,VEHICLE_CATALOG} from '../public/catalog.js';

// Body metadata keyed by the existing catalog's canonical identity, not a second
// make/model alias catalog. Unsupported/ambiguous models stay unknown.
const groups={
 Toyota:{SUV:['4-Runner','FJ Cruiser','Highlander','Land Cruiser','Land Cruiser Prado','Prado','Fortuner','RAV4','Sequoia','Urban Cruiser','Raize','Rush','bZ4X'],sedan:['Camry','Corolla','Corolla sedan','Avalon','Cressida'],pickup:['Hilux','Tundra','Tacoma'],van:['Hiace','Hiace Van','Innova','Previa','Veloz','Coaster','Corolla Verso','Verso'],coupe:['GT86','86','GR86','Supra'],wagon:['Corolla Combi','Avensis Combi']},
 Nissan:{SUV:['Patrol','Patrol GR','X-Trail','Pathfinder','X-Terra','Kicks','Armada','Juke','Murano','Qashqai','Terrano','Ariya'],sedan:['Altima','Maxima','Maxima QX','Sunny','Sentra'],pickup:['Navara','NP300 Pickup','Pickup','King Cab'],van:['Urvan','NV200','NV400','Serena'],hatchback:['Leaf','Micra'],coupe:['GT-R','Z','350 Z','370 Z']},
 Honda:{SUV:['CR-V','HR-V','Pilot','ZRV','Passport'],sedan:['Accord','City'],pickup:['Ridgeline'],van:['Odyssey'],hatchback:['Jazz','Fit','Civic Type R'],coupe:['Accord Coupé','Civic Coupé'],wagon:['Accord Tourer','Civic Tourer']},
 Mazda:{SUV:['CX-3','CX-5','CX-7','CX-9','CX-30','CX-50','CX-60','CX-8','CX-90'],sedan:['6','626'],wagon:['6 Combi','626 Combi'],van:['5','MPV'],coupe:['RX-7','RX-8'],convertible:['MX-5']},
 Lexus:{SUV:['RX','RX 300','RX 400h','RX 450h','LX','GX','NX','UX','RZ','LBX','TX'],sedan:['ES','GS','GS 300','IS','IS 200','IS-F','LS'],hatchback:['CT'],coupe:['RC','RC F','LFA']},
 Mitsubishi:{SUV:['Pajero','Pajero Sport','Pajero Wagon','Pajero Pinin Wagon','Outlander','ASX','Montero Sport','Eclipse Cross'],sedan:['Attrage','Galant','Lancer','Lancer Evo'],pickup:['L200','L200 Pick up','L200 Pick up Allrad'],van:['L300','Grandis','Xpander'],wagon:['Lancer Combi','Galant Combi'],hatchback:['Lancer Sportback']},
 Jeep:{SUV:['Wrangler','Grand Cherokee','Cherokee','Compass','Renegade'],pickup:['Gladiator']}
};
const modelBodies=new Map();
for(const [make,types]of Object.entries(groups))for(const [bodyType,models]of Object.entries(types))for(const model of models){
 if(VEHICLE_CATALOG.makes.find(m=>m.name===make)?.models.some(m=>m.name===model))modelBodies.set(`${make}::${model}`,bodyType);
}
export function normalizeBodyType(value){
 const q=catalogText(value);
 if(/^(?:suv|crossover|cuv)(?: (?:suv|crossover|cuv))*$/.test(q))return 'SUV';
 const aliases={SUV:['suv','sport utility vehicle','sports utility vehicle','crossover','cuv','جيب','كروس اوفر','دفع رباعي'],sedan:['sedan','saloon','سيدان'],coupe:['coupe','كوبيه','كوبي'],hatchback:['hatchback','hatch back','هاتشباك','هاتش باك'],pickup:['pickup','pick up','pickup truck','truck','بيك اب','بيكاب','وانيت','شاحنه'],van:['van','minivan','mini van','mpv','bus','فان','ميني فان','حافله'],wagon:['wagon','estate','station wagon','ستيشن واجن'],convertible:['convertible','cabriolet','رودستر','مكشوفه']};
 for(const [body,values]of Object.entries(aliases))if(values.map(catalogText).includes(q))return body;
 // 4x4 / AWD / 4WD alone are drivetrain evidence, never sufficient body evidence.
 return null;
}
function titleBody(title){
 const q=` ${catalogText(title)} `,found=[];
 for(const [type,re]of Object.entries({SUV:/(?: suv | crossover | cuv | كروس اوفر )/,sedan:/(?: sedan | saloon | سيدان )/,coupe:/(?: coupe | كوبيه )/,hatchback:/(?: hatchback | hatch back | هاتشباك | هاتش باك )/,pickup:/(?: pickup | pick up | بيك اب | بيكاب | وانيت )/,van:/(?: minivan | mini van | van | mpv | فان )/,wagon:/(?: wagon | estate | واجن )/,convertible:/(?: convertible | cabriolet | مكشوفه )/}))if(re.test(q))found.push(type);
 return found.length===1?found[0]:null;
}
export function bodyTypeEvidence(car={}){
 const source=normalizeBodyType(car.bodyType)||normalizeBodyType(car.vehicle?.bodyType);
 if(source)return {bodyType:source,source:'source-body-type'};
 const declared=catalogIntent(`${car.make||car.brand||''} ${car.model||''}`),fromTitle=catalogIntent(car.title||'');
 const identity=declared.known?declared:fromTitle;
 const model=VEHICLE_CATALOG.makes.find(m=>m.name===identity.make)?.models.find(m=>m.name===identity.model);
 const catalogBody=normalizeBodyType(model?.bodyType);
 if(catalogBody)return {bodyType:catalogBody,source:'catalog-body-type'};
 const text=catalogText(`${car.model||''} ${car.title||''}`),explicit=titleBody(text);
 // Specific variants outrank a base-model mapping (a Land Cruiser pickup is not an SUV).
 if(identity.make==='Toyota'&&/\bcorolla cross\b|كورولا كروس/.test(text))return {bodyType:'SUV',source:'model-variant'};
 if(identity.make==='Toyota'&&identity.model==='Land Cruiser'&&explicit==='pickup')return {bodyType:'pickup',source:'model-variant'};
 if(['Toyota::Corolla','Honda::Accord','Mazda::6'].includes(identity.modelKey)&&['hatchback','coupe','wagon'].includes(explicit))return {bodyType:explicit,source:'model-variant'};
 const mapped=modelBodies.get(identity.modelKey);
 if(mapped)return {bodyType:mapped,source:'catalog-model-mapping'};
 const make=catalogMake(car.make||car.brand||'')?.name;
 const compact=catalogText(car.model||'').replace(/ /g,'');
 if(make&&compact)for(const [key,bodyType]of modelBodies){const [brand,name]=key.split('::');if(brand===make&&catalogText(name).replace(/ /g,'')===compact)return {bodyType,source:'normalized-catalog-model'};}
 if(explicit)return {bodyType:explicit,source:'listing-title'};
 return {bodyType:null,source:'unknown'};
}
export const resolveBodyType=car=>bodyTypeEvidence(car).bodyType;
export const bodyTypeMappingCount=modelBodies.size;
