import {catalogIntent,catalogMake,catalogText} from '../public/catalog.js';
export const CLASSIFICATION_VERSION=1;
const NON_AUTO=/(?:\b(?:pubg|gaming|game account|skin|skins|chicken|chickens|rooster|cat|kitten|dog|puppy|bird|toy|diecast|collectible|shirt|clothing|merchandise|perfume|watch)\b|ببجي|بوبجي|حساب\s*(?:لعب|ببجي|فورت)|دجاج|دجاجه|ديك|ديكه|قطط|قطه|كلاب|كلب|خيول|طيور|ساعه|ريموت اطفال|مجسم|مصغر|لعبه|العاب|عطر|بخور|ملابس)/i;
const PART=/(?:\b(?:engine|gearbox|transmission|rim|rims|tyre|tyres|tire|tires|bumper|headlight|radiator|spare parts?)\b|مكينه|محرك|قير|جير|جنط|جنوط|كفرات|اطارات|صدام|شمعه|شمعات|رديتر|قطع\s*(?:ال)?غيار)/i;
const ACCESSORY=/(?:accessor|body kit|stereo|head unit|اكسسوار|شاشه|مسجل|فرشه|تلبيسه|طقم|غطاء|سبويلر)/i;
const WANTED=/(?:\bwanted\b|looking for|want to buy|مطلوب|ابحث عن|نشتري سيارات|شراء سيارات)/i;
const SERVICE=/(?:for rent|rental|repair service|workshop|car wash|للايجار|تاجير|ورشه|تصليح|خدمه صيانه|غسيل سيارات|سطحه)/i;
const COMPLETE_CATEGORY=/(?:^|\s)(?:cars|cars for sale|vehicles for sale|used cars|new cars|حراج السيارات|سيارات للبيع|سيارات مستعمله|سيارات جديده)(?:\s|$)/i;
const positiveNumber=v=>v!=null&&Number.isFinite(Number(v))&&Number(v)>0;
export function vehicleIdentity(car={}){
 const declaredMake=catalogMake(car.make||car.brand||car.vehicle?.make||'');
 const declaredModel=car.model||car.vehicle?.model;
 // Structured fields win; descriptions and URLs never establish identity.
 const structured=declaredMake&&declaredModel?catalogIntent(`${declaredMake.name} ${declaredModel}`):null;
 const title=catalogIntent(car.title||car.name||'');
 const conflict=Boolean(declaredMake&&title.make&&declaredMake.name!==title.make);
 const make=declaredMake?.name||title.make||(car.schemaType==='Car'||/\/(?:cardetail|used-car)\//.test(car.url||'')?String(car.make||car.brand||'').trim()||null:null);
 const model=declaredModel?(structured?.model||null):(!conflict?title.model:null);
 return {make,model,makeKey:make?catalogText(make).toUpperCase():null,modelKey:model?catalogText(model).toUpperCase():null,conflict,origin:declaredMake&&declaredModel?'structured':'title'};
}
export function classifyVehicle(car={}){
 const title=catalogText(car.title||car.name),description=catalogText(car.description||car.snippet||'');
 const category=catalogText([car.sourceCategory,car.sourceSubcategory,car.category,car.categoryPath].flat().filter(Boolean).join(' '));
 const identity=vehicleIdentity(car),evidence=[];
 const result=(classification,reason)=>({classification,reason,evidence,identity,version:CLASSIFICATION_VERSION});
 if(/^(?:for sale\s+)?horse(?:\s|$)/i.test(title)||/\bhorse\b/i.test(category)||NON_AUTO.test(category)||NON_AUTO.test(title)||NON_AUTO.test(description))return result('NON_AUTOMOTIVE','non_automotive_subject');
 if(WANTED.test(title)||WANTED.test(category)||WANTED.test(description))return result('WANTED_VEHICLE','wanted_ad');
 if(SERVICE.test(title)||SERVICE.test(category)||/^(?:for rent|rental|repair service|workshop|car wash|ورشه|تصليح|للايجار|تاجير)/.test(description))return result('NON_AUTOMOTIVE','service_or_rental');
 if(PART.test(category))return result('VEHICLE_PART','parts_category');
 if(ACCESSORY.test(category))return result('VEHICLE_ACCESSORY','accessory_category');
 // A complete car can describe its engine/transmission or replaced tyres.
 // Parts as the sale subject, or a parts-led title, are different evidence.
 const partsSubject=PART.test(title)&&(/^(?:للبيع\s+)?(?:مكينه|محرك|قير|جير|جنط|جنوط|كفرات|صدام|شمعه|رديتر|engine|gearbox|rim|tyre|tire|bumper|radiator)(?:\s|$)/i.test(title)||/قطع\s*غيار|spare parts|(?:engine|gearbox|rims?|tyres?|tires?)\s*(?:for sale|only|$)|(?:مكينه|محرك|قير|جنط|جنوط|كفرات)\s*(?:للبيع|فقط|$)/i.test(title));
 if(partsSubject||/^(?:(?:للبيع|بيع)\s+)?(?:مكينه|محرك|قير|جير|جنوط|كفرات|rims?|tyres?|tires?|spare parts|engine|gearbox)\s*(?:للبيع|for sale|فقط|only|$)/.test(description))return result('VEHICLE_PART','part_sale_subject');
 if(ACCESSORY.test(title)||/^(?:اكسسوار|accessor|body kit)/.test(description))return result('VEHICLE_ACCESSORY','accessory_sale_subject');
 let url;try{url=new URL(car.source_url||car.url||car.originalUrl);if(!/^https?:$/.test(url.protocol))throw Error();}catch{return result('UNKNOWN','invalid_source_url');}
 if(identity.conflict)return result('UNKNOWN','conflicting_identity');
 if(!identity.make)return result('UNKNOWN','unrecognized_make');
 const vehicleCategory=COMPLETE_CATEGORY.test(category)||/\/(?:cardetail|used-car|cars-for-sale)\//i.test(url.pathname)||['Car','Vehicle'].includes(car.schemaType);
 if(vehicleCategory)evidence.push('complete_vehicle_category');
 if(identity.model)evidence.push('catalog_identity');
 const year=Number(car.year)||Number(title.match(/\b((?:19|20)\d{2})\b/)?.[1]);
 if(year>=1886&&year<=new Date().getFullYear()+2)evidence.push('model_year');
 if(positiveNumber(car.mileage_km??car.mileageKm??car.mileage))evidence.push('odometer');
 if(positiveNumber(car.price_sar??car.price))evidence.push('asking_price');
 if(car.bodyType||car.body_type||car.transmission||car.fuelType)evidence.push('vehicle_attributes');
 if(/للبيع|for sale|استماره|فحص دوري|مالك|registration|registered/i.test(`${title} ${description}`))evidence.push('sale_context');
 if((car.images||[]).length||car.image||car.primary_image)evidence.push('image_available');
 if(!identity.model&&!vehicleCategory)return result('UNKNOWN','unresolved_model');
 const independent=evidence.filter(x=>!['catalog_identity','image_available'].includes(x)).length;
 if((vehicleCategory&&evidence.length>=2)||(identity.model&&independent>=2))return result('VEHICLE_FOR_SALE','multiple_vehicle_signals');
 return result('UNKNOWN','insufficient_vehicle_evidence');
}
const metrics={};
export function recordClassification(source,verdict,stage='ingestion'){
 const key=String(source||'Unknown');
 const sourceMetrics=metrics[key]||={ingested:0,classes:{},reasons:{},identityFailures:0,validation:{evaluated:0,classes:{},reasons:{},identityFailures:0}};
 const m=stage==='validation'?sourceMetrics.validation:sourceMetrics;
 if(stage==='validation')m.evaluated++;else m.ingested++;
 m.classes[verdict.classification]=(m.classes[verdict.classification]||0)+1;
 m.reasons[verdict.reason]=(m.reasons[verdict.reason]||0)+1;
 if(!verdict.identity.make||!verdict.identity.model)m.identityFailures++;
}
export function classificationMetrics(){return structuredClone(metrics);}
