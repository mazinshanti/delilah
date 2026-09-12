import {normalizeSearchText} from './search-relevance.js';

export const MODEL_GROUPS={
  corolla:['corolla','كورولا','كرولا','كورلا','كوريلا'],camry:['camry','كامري'],yaris:['yaris','يارس'],patrol:['patrol','باترول'],sunny:['sunny','صني'],wrangler:['wrangler','رانجلر'],
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
  continental:['continental','كونتيننتال'],bentayga:['bentayga','بنتايجا','بنتايغا']
};

function hasAlias(text='',alias=''){
  const hay=` ${normalizeSearchText(text)} `;
  const needle=` ${normalizeSearchText(alias)} `;
  return needle.trim().length>0&&hay.includes(needle);
}

export function detectRequestedModel(query=''){
  const q=normalizeSearchText(query);
  if(!q)return null;
  for(const[model,aliases]of Object.entries(MODEL_GROUPS))if(aliases.some(alias=>hasAlias(q,alias)))return model;
  return null;
}

export function listingMatchesModel(car={},model=null){
  if(!model)return true;
  const aliases=MODEL_GROUPS[model]||[model];
  const evidence=[car.model,car.title,car.snippet,car.url,car.originalUrl].filter(Boolean).join(' ');
  return aliases.some(alias=>hasAlias(evidence,alias));
}
