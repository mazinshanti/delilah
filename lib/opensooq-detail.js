import {cleanText,inventoryRecord} from './public-inventory.js';
import {catalogIntent} from '../public/catalog.js';
const adId=raw=>{try{const u=new URL(raw);return /^https?:$/.test(u.protocol)&&u.hostname==='sa.opensooq.com'&&!u.port&&!u.username&&!u.password?u.pathname.match(/^\/en\/search\/(\d{6,})\/?$/)?.[1]||null:null;}catch{return null;}};
export function parseOpenSooqDetail(html,url,source){
 const id=adId(url);if(!id||!url.startsWith('https:'))return [];
 const canonical=html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];if(adId(canonical)!==id)return [];
 const h1=/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);if(!h1)return [];
 const title=cleanText(h1[1]),listing=html.indexOf('Listing Id',h1.index),end=html.indexOf('</ul>',listing);
 if(listing<0||end<0)return [];const panel=html.slice(h1.index,end+5);
 const fields=new Map();for(const match of panel.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)){
  const parts=[...match[1].matchAll(/<(?:span|a)\b[^>]*>([\s\S]*?)<\/(?:span|a)>/gi)].map(m=>cleanText(m[1]));
  if(parts.length===2){if(fields.has(parts[0])&&fields.get(parts[0])!==parts[1])return [];fields.set(parts[0],parts[1]);}
 }
 if(fields.get('Listing Id')!==id||fields.get('Sub Category')!=='Cars For Sale')return [];
 const nodes=[];for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const n=JSON.parse(match[1]);if(n['@type']==='Vehicle'&&adId(n.url)===id)nodes.push(n);}catch{}}
 if(nodes.length!==1)return [];const v=nodes[0],offer=v.offers||{};
 if(cleanText(v.name)!==title||adId(offer.url)!==id||!/\/InStock$/.test(offer.availability||''))return [];
 const conditionMatch=panel.match(/<img\b[^>]*src=["'][^"']*\/condition\.webp["'][^>]*alt=["'](Used|New)["']/i);
 const condition=conditionMatch?.[1].toLowerCase();if(!condition)return [];
 if(v.itemCondition&&((/UsedCondition$/.test(v.itemCondition)&&condition!=='used')||(/NewCondition$/.test(v.itemCondition)&&condition!=='new')))return [];
 const mileageMatch=panel.match(/<img\b[^>]*src=["'][^"']*\/kilometers\.webp["'][^>]*alt=["']([\d,]+) km["']/i);
 const mileage=mileageMatch?Number(mileageMatch[1].replace(/,/g,'')):null;if(condition==='new'&&mileage>100)return [];
 const cat=catalogIntent(title),years=[...title.matchAll(/\b((?:19|20)\d{2})\b/g)].map(m=>Number(m[1]));if(new Set(years).size!==1)return [];
 const city=fields.get('City'),image=typeof v.image==='string'?v.image:v.image?.contentUrl||v.image?.url;
 const record=inventoryRecord({url,title,description:v.description,schemaType:'Vehicle',make:cat.make,model:cat.model,year:years[0],condition,mileage,city:city==='Al Riyadh'?'Riyadh':city,price:offer.priceCurrency==='SAR'?offer.price:null,image,images:image?[image]:[],bodyType:fields.get('Body Type'),transmission:fields.get('Transmission')},source);
 return record?[{...record,detailChecked:true,evidenceLevel:'exact-ad-schema-and-primary-specs'}]:[];
}
