import {catalogText} from '../public/catalog.js';
const groups=[['Riyadh','الرياض','Al Riyadh'],['Jeddah','جدة','جده'],['Dammam','الدمام'],['Khobar','الخبر','Al Khobar'],['Makkah','مكة','مكه','Mecca'],['Madinah','المدينة','المدينة المنورة','Al Madinah','Medina'],['Taif','الطائف'],['Tabuk','تبوك','Tabouk'],['Buraidah','بريدة','Qasim Breda'],['Abha','أبها'],['Jazan','جازان','جيزان','Jeezan'],['Hail','حائل'],['Najran','نجران'],['Yanbu','ينبع'],['Jubail','الجبيل'],['Hofuf','الهفوف'],['Qatif','القطيف'],['AlAhsa','الأحساء','Al Ahsa']];
const names=new Map(groups.flatMap(g=>g.map(n=>[catalogText(n),g[0]])));
export const canonicalCity=value=>names.get(catalogText(value))||String(value||'').trim()||null;
export const cityKey=value=>catalogText(canonicalCity(value));
