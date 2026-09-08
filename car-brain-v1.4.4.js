import * as base from "./car-brain-v1.4.3.js";
import { norm } from "./car-brain-v1.4.js";
import { saudiKnowledgePrompt } from "./saudi-auto-knowledge-v1.5.js";

export const BRAIN_VERSION="1.5.1-saudi-auto-brain";
const EXTRA=/(?:^|\s)(?:car key|key fob|key shell|remote key|remote control|مفتاح|مفاتيح|ريموت|ريموتات|شاشه|شاشة|مسجل|dashcam|داش كام|دعاسات|شاحن|charger|بطاريه|بطارية|battery|حساس|sensor|فلتر|filter|زيت|oil)(?:\s|$)/i;
const FAMILY_CONTEXT=/(?:^|\s)(?:طفل|طفلين|اطفال|أطفال|اولاد|أولاد|زوجتي|زوجي|عائلتي|اسرتي|أسرتي|family|kids?|children|wife|husband)(?:\s|$)/i;
const asciiDigits=s=>String(s||"").replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
function cashBudget(query=""){
  const x=asciiDigits(query).replace(/,/g,"");
  const m=x.match(/([0-9]{4,7})\s*(?:ريال|ر\s*\.?\s*س|sar)(?![\p{L}\p{N}])/iu)||x.match(/(?:ميزانيتي|ميزانيه|ميزانية|معي|معاي|معايا|معاية|budget|have)\D{0,20}([0-9]{4,7})/iu);
  if(!m)return null;const n=Number(m[1]);return Number.isFinite(n)&&n>=1000&&n<=5_000_000?n:null;
}

export function detectAutomotiveIntent(query="",body={}){
  const x=base.detectAutomotiveIntent(query,body),n=norm(query),budget=x.maxPrice||cashBudget(query);
  const needs=[...new Set([...(x.needs||[]),...(FAMILY_CONTEXT.test(n)?["family"]:[])])];
  const explicit=[...new Set([...(x.explicit||[]),...(budget?["maxPrice"]:[])])];
  return {...x,needs,maxPrice:budget,explicit,partsRequested:x.partsRequested||EXTRA.test(n)};
}

function budgetFamilyQueries(intent={}){
  if(!(intent.needs||[]).includes("family"))return[];
  if((intent.explicit||[]).includes("bodyType"))return[];
  const b=Number(intent.maxPrice)||Infinity;
  if(b<=40000)return ["Toyota Corolla","Toyota Yaris","Toyota Camry","Nissan Sunny","Hyundai Accent","Hyundai Elantra","Kia Cerato","Honda City"];
  if(b<=80000)return ["Toyota Corolla","Toyota Camry","Toyota Yaris","Nissan Sunny","Hyundai Elantra","Hyundai Sonata","Kia Cerato","Honda Accord","Toyota RAV4","Hyundai Tucson"];
  return ["Toyota Camry","Toyota Corolla","Toyota RAV4","Toyota Fortuner","Nissan X-Trail","Honda CR-V","Mazda CX-5","Hyundai Tucson","Kia Sportage","Kia Sorento"];
}

export function buildRetrievalQueries(intent,original=""){
  if(intent.partsRequested)return[];
  const out=[],push=q=>{q=String(q||"").trim();if(q&&!out.some(x=>norm(x)===norm(q)))out.push(q)};
  if(intent.brand&&intent.model)push(`${intent.brand} ${intent.model}`);else if(intent.brand)push(intent.brand);
  if(!intent.brand&&!intent.model)for(const q of budgetFamilyQueries(intent)){push(q);if(out.length>=10)break;}
  for(const q of intent.retrievalQueries||[]){push(q);if(out.length>=10)break;}
  if(!out.length)for(const q of base.buildRetrievalQueries(intent,original)){push(q);if(out.length>=10)break;}
  return out.slice(0,10);
}

export function knowledgePrompt(intent={},query=""){
  return `${base.knowledgePrompt(intent)}\n- Keys, remotes, screens, stereos, dashcams, chargers, batteries, sensors, filters, oils and similar accessories/consumables are outside the current product.\n- Family does NOT automatically mean SUV. A couple with one or two children can be well served by a sedan, hatchback or crossover.\n- Budget is a major recommendation constraint. For low budgets, prioritize realistic affordable used cars rather than expensive SUVs.\n- When the user gives a total budget such as 30,000 SAR, search vehicles plausibly available within that budget and keep known higher-priced vehicles out.\n- Arabic-Indic digits and informal phrases such as معي/معاية/ميزانيتي followed by an amount in ريال are real budget constraints.\n- If the user mentions spouse, children or kids, infer family use unless they explicitly say otherwise.\n${saudiKnowledgePrompt(query,intent)}`;
}

export function prepareResults(groups,intent,limit=500){
  return base.prepareResults(groups,intent,limit).filter(c=>{
    let path="";try{path=decodeURIComponent(new URL(c.url).pathname)}catch{}
    return !EXTRA.test(norm(`${c.title||""} ${path}`));
  });
}
export const resultSummary=base.resultSummary;
