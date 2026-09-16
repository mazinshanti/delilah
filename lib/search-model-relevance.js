import {normalizeSearchText} from './search-relevance.js';

export const MODEL_GROUPS={
  'peugeot 2008':['peugeot 2008','بيجو 2008'],
  'mazda 6':['mazda 6','mazda6','مازدا 6'],
  'mazda 3':['mazda 3','mazda3','مازدا 3'],
  corolla:['corolla','كورولا','كرولا','كورلا','كوريلا'],camry:['camry','كامري','كامرى'],yaris:['yaris','يارس'],patrol:['patrol','باترول'],sunny:['sunny','صني'],wrangler:['wrangler','رانجلر'],
  'land cruiser':['land cruiser','لاند كروزر','لاندكروزر'],prado:['prado','برادو'],fortuner:['fortuner','فورتشنر'],rav4:['rav4','rav 4','راف 4','راف4'],hilux:['hilux','هايلوكس'],
  tucson:['tucson','توسان'],elantra:['elantra','النترا','إلنترا'],sonata:['sonata','سوناتا'],accent:['accent','اكسنت','أكسنت'],palisade:['palisade','باليسيد'],
  sportage:['sportage','سبورتاج'],sorento:['sorento','سورينتو'],cerato:['cerato','سيراتو'],k5:['k5','k 5','كي 5'],
  tahoe:['tahoe','تاهو'],yukon:['yukon','يوكن'],silverado:['silverado','سلفرادو'],
  altima:['altima','التيما','ألتيما'],pathfinder:['pathfinder','باثفايندر'],kicks:['kicks','كيكس'],'x-trail':['x trail','x-trail','اكس تريل'],
  territory:['territory','تيريتوري'],taurus:['taurus','توروس'],explorer:['explorer','اكسبلورر','إكسبلورر'],expedition:['expedition','اكسبدشن','إكسبديشن'],bronco:['bronco','برونكو'],
  x5:['bmw x5','x5'],x6:['bmw x6','x6'],x3:['bmw x3','x3'],'5 series':['5 series','520i','530i','540i'],
  c200:['c200','c 200'],glc:['glc'],gle:['gle'],
  rx:['lexus rx','rx'],es:['lexus es','es'],lx:['lexus lx','lx'],
  coolray:['coolray','كولراي'],preface:['preface','بريفيس','بريفايس'],monjaro:['monjaro','مونجارو'],
  eado:['eado','ايدو','إيدو'],cs75:['cs75','cs 75','سي اس 75'],'cs55':['cs55','cs 55','سي اس 55'],
  h6:['h6','هافال h6'],jolion:['jolion','جوليون'],mg5:['mg5','mg 5','ام جي 5'],
  continental:['continental','كونتيننتال'],bentayga:['bentayga','بنتايجا','بنتايغا','بنتياقا'],
  'flying spur':['flying spur','flying spear','flying spare','فلاينج سبير','فلاينغ سبير'],mulsanne:['mulsanne','مولسان'],
  avalon:['avalon','افالون'],veloz:['veloz','فيلوز'],raize:['raize','رايز'],rush:['rush','راش'],highlander:['highlander','هايلاندر'],
  creta:['creta','كريتا'],azera:['azera','ازيرا'],staria:['staria','ستاريا'],'santa fe':['santa fe','سنتافي'],
  charger:['charger','تشارجر'],challenger:['challenger','تشالنجر'],durango:['durango','دورانجو'],
  accord:['accord','اكورد'],civic:['civic','سيفيك'],'cr-v':['cr v','cr-v'],pilot:['pilot','بايلوت'],
  'grand cherokee':['grand cherokee','جراند شيروكي'],compass:['compass','كومباس'],gladiator:['gladiator','جلاديتور'],
  pegas:['pegas','بيجاس'],carnival:['carnival','كرنفال'],seltos:['seltos','سيلتوس'],
  edge:['edge','ايدج'],mustang:['mustang','موستانج'],ranger:['ranger','رينجر'],'f-150':['f150','f 150','f-150'],
  captiva:['captiva','كابتيفا'],traverse:['traverse','ترافيرس'],suburban:['suburban','سوبربان'],camaro:['camaro','كمارو'],
  sierra:['sierra','سييرا'],acadia:['acadia','اكاديا'],'cx-5':['cx-5','cx5','cx 5'],'cx-9':['cx-9','cx9','cx 9'],
  pajero:['pajero','باجيرو'],outlander:['outlander','اوتلاندر'],attrage:['attrage','اتراج'],
  'range rover sport':['range rover sport','رينج روفر سبورت'],defender:['defender','ديفندر'],discovery:['discovery','ديسكفري'],
  cayenne:['cayenne','كايين'],macan:['macan','ماكان'],panamera:['panamera','باناميرا'],
  'tank 300':['tank 300','تانك 300'],dashing:['dashing','داشينج'],emgrand:['emgrand','امجراند'],
  x1:['bmw x1','x1'],x7:['bmw x7','x7'],'3 series':['3 series','320i','330i'],'7 series':['7 series','730li','740li'],
  'g class':['g class','g-class','g500','g63'],'e class':['e class','e-class','e200','e300'],
  's class':['s class','s-class','s500','s450'],gls:['gls'],eqa:['eqa'],
  'model 3':['model 3'],'model y':['model y'],duster:['duster','داستر']
};

const MODEL_ALIASES=Object.entries(MODEL_GROUPS).flatMap(([model,aliases])=>aliases.map(alias=>({model,alias:` ${normalizeSearchText(alias)} `,length:alias.length}))).sort((a,b)=>b.length-a.length);
const modelCache=new Map();
export function detectRequestedModel(query=''){
 const q=normalizeSearchText(query);if(!q)return null;
 if(modelCache.has(q))return modelCache.get(q);
 const hay=` ${q} `,model=MODEL_ALIASES.find(a=>hay.includes(a.alias))?.model||null;
 if(modelCache.size>5000)modelCache.clear();modelCache.set(q,model);return model;
}
export function listingMatchesModel(car={},model=null){
 if(!model)return true;
 const hay=` ${normalizeSearchText([car.model,car.title,car.snippet,car.url,car.originalUrl].filter(Boolean).join(' '))} `;
 return (MODEL_GROUPS[model]||[model]).some(alias=>hay.includes(` ${normalizeSearchText(alias)} `));
}
