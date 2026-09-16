// Conservative extraction: unknown vehicle words remain in the query and cannot broaden it.
export function naturalSearch(value=''){
 let query=String(value).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));const filters={};let condition=null;
 query=query.replace(/(?:under|below|budget(?: of)?|أقل من|اقل من|بأقل من|تحت|بحدود|ميزانية)\s*([\d,٬]+)\s*(thousand|k\b|ألف|الف)?\s*(?:SAR|riyals?|ريال)?/gi,(_,n,k)=>{filters.maxPrice=Number(n.replace(/[,٬]/g,''))*(k?1000:1);return ' ';});
 const cities=[['Riyadh','الرياض'],['Jeddah','جدة'],['Dammam','الدمام'],['Khobar','الخبر'],['Makkah','مكة'],['Madinah','المدينة'],['Abha','أبها'],['Tabuk','تبوك']];
 for(const [city,ar]of cities)query=query.replace(new RegExp('(?:^|\\s)(?:in\\s+|في\\s+|ب)?(?:'+city+'|'+ar+')(?=\\s|$)','gi'),()=>{filters.city=city;return ' ';});
 query=query.replace(/(?:^|\s)(new|used|جديدة|جديد|مستعملة|مستعمل)(?=\s|$)/gi,(_,word)=>{condition=/new|جديد/i.test(word)?'new':'used';return ' ';});
 query=query.replace(/(?:^|\s)(?:find me|show me|looking for|i want|ابحث عن|أبحث عن|ابغى|أبغى|اريد|أريد|سيارة|سياره)(?=\s|$)/gi,' ').replace(/\s+/g,' ').trim();
 return{query:query||'__all_cars__',filters,condition};
}
