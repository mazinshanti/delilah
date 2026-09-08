import * as base from "./car-brain-v1.4.4.js";
import { norm } from "./car-brain-v1.4.js";

export const BRAIN_VERSION="1.4.5-car-brain";

const FAMILY_CONTEXT=/(?:^|\s)(?:طفل|طفلين|اطفال|أطفال|اولاد|أولاد|زوجتي|زوجي|عائلتي|اسرتي|أسرتي|family|kids?|children|wife|husband)(?:\s|$)/i;

export function detectAutomotiveIntent(query="",body={}){
  const x=base.detectAutomotiveIntent(query,body);
  const n=norm(query);
  const needs=[...new Set([...(x.needs||[]),...(FAMILY_CONTEXT.test(n)?["family"]:[])])];
  return {...x,needs};
}

function budgetFamilyQueries(intent={}){
  if(!(intent.needs||[]).includes("family"))return[];
  if((intent.explicit||[]).includes("bodyType"))return[];
  const b=Number(intent.maxPrice)||Infinity;
  if(b<=40000)return [
    "Toyota Corolla","Toyota Yaris","Toyota Camry","Nissan Sunny",
    "Hyundai Accent","Hyundai Elantra","Kia Cerato","Honda City"
  ];
  if(b<=80000)return [
    "Toyota Corolla","Toyota Camry","Toyota Yaris","Nissan Sunny",
    "Hyundai Elantra","Hyundai Sonata","Kia Cerato","Honda Accord",
    "Toyota RAV4","Hyundai Tucson"
  ];
  return [
    "Toyota Camry","Toyota Corolla","Toyota RAV4","Toyota Fortuner",
    "Nissan X-Trail","Honda CR-V","Mazda CX-5","Hyundai Tucson",
    "Kia Sportage","Kia Sorento"
  ];
}

export function buildRetrievalQueries(intent,original=""){
  if(intent.partsRequested)return[];
  const out=[];
  const push=q=>{q=String(q||"").trim();if(q&&!out.some(x=>norm(x)===norm(q)))out.push(q)};
  if(intent.brand&&intent.model)push(`${intent.brand} ${intent.model}`);
  else if(intent.brand)push(intent.brand);
  if(!intent.brand&&!intent.model){
    for(const q of budgetFamilyQueries(intent)){push(q);if(out.length>=10)break;}
  }
  for(const q of intent.retrievalQueries||[]){push(q);if(out.length>=10)break;}
  if(!out.length){
    for(const q of base.buildRetrievalQueries(intent,original)){push(q);if(out.length>=10)break;}
  }
  return out.slice(0,10);
}

export function knowledgePrompt(intent={}){
  return `${base.knowledgePrompt(intent)}\n- Family does NOT automatically mean SUV. A couple with one or two children can be well served by a sedan, hatchback or crossover.\n- Budget is a major recommendation constraint. For low budgets, prioritize realistic affordable used cars rather than expensive SUVs.\n- When the user gives a total cash budget such as 30,000 SAR, search vehicles plausibly available within that budget and keep higher-priced vehicles out.\n- If the user mentions spouse, children or kids, infer family use unless they explicitly say otherwise.`;
}

export const prepareResults=base.prepareResults;
export const resultSummary=base.resultSummary;
