import {emptyIntent} from '../../lib/ai-search-intent.js';
// 50 semantic scenarios, each with Arabic and English wording. Synthetic, not traffic-derived.
const vehicles=[['Toyota','Corolla','تويوتا كورولا'],['Toyota','Camry','تويوتا كامري'],['Hyundai','Elantra','هيونداي النترا'],['Nissan','Sunny','نيسان صني'],['Audi','Q8','اودي كيو 8'],['Toyota','Fortuner','تويوتا فورتشنر'],['Honda','Accord','هوندا اكورد'],['Kia','Sportage','كيا سبورتاج']];
const scenarios=[];
for(const [make,model,ar] of vehicles)for(const [condition,city,maxPrice] of [['used','Riyadh',80000],['used','Jeddah',45000],['new',null,100000],['used','Dammam',150000],['used',null,5000]]){
 const cityAr={Riyadh:'الرياض',Jeddah:'جدة',Dammam:'الدمام'}[city];
 scenarios.push({fields:{make,model,condition,city,maxPrice},en:`${condition} ${make} ${model} under ${maxPrice}${city?' in '+city:''}`,ar:`${ar} ${condition==='new'?'جديدة':'مستعملة'} تحت ${maxPrice}${city?' في '+cityAr:''}`});
}
for(const origin of ['Japanese','German','Korean','Chinese','American'])for(const bodyType of ['SUV','sedan'])scenarios.push({fields:{originPreference:origin,bodyType,maxPrice:150000,condition:'used',city:'Riyadh'},en:`used ${origin} ${bodyType} under 150000 in Riyadh`,ar:`سيارة ${ {Japanese:'يابانية',German:'المانية',Korean:'كورية',Chinese:'صينية',American:'امريكية'}[origin]} ${bodyType==='SUV'?'دفع رباعي':'سيدان'} مستعملة تحت 150000 في الرياض`});
export const benchmark=scenarios.flatMap((s,index)=>['ar','en'].map(language=>({id:`q${index+1}-${language}`,pair:index+1,language,query:s[language],intent:{...emptyIntent(),...s.fields,query:s[language],confidence:1},reviewStatus:'unreviewed',referenceAds:null})));
