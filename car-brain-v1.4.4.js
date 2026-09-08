import * as base from "./car-brain-v1.4.3.js";
import { norm } from "./car-brain-v1.4.js";

export const BRAIN_VERSION="1.4.4-car-brain";
const EXTRA=/(?:^|\s)(?:car key|key fob|key shell|remote key|remote control|مفتاح|مفاتيح|ريموت|ريموتات|شاشه|شاشة|مسجل|dashcam|داش كام|دعاسات|شاحن|charger|بطاريه|بطارية|battery|حساس|sensor|فلتر|filter|زيت|oil)(?:\s|$)/i;

export function detectAutomotiveIntent(query="",body={}){
  const x=base.detectAutomotiveIntent(query,body);
  return {...x,partsRequested:x.partsRequested||EXTRA.test(norm(query))};
}
export const buildRetrievalQueries=base.buildRetrievalQueries;
export function knowledgePrompt(intent={}){
  return `${base.knowledgePrompt(intent)}\n- Keys, remotes, screens, stereos, dashcams, chargers, batteries, sensors, filters, oils and similar accessories/consumables are also outside the current product.`;
}
export function prepareResults(groups,intent,limit=500){
  return base.prepareResults(groups,intent,limit).filter(c=>{
    let path="";try{path=decodeURIComponent(new URL(c.url).pathname)}catch{}
    return !EXTRA.test(norm(`${c.title||""} ${path}`));
  });
}
export const resultSummary=base.resultSummary;
