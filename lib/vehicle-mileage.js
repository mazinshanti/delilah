// Only explicit odometer evidence; never infer from price, year, or condition.
export function extractMileage(text=''){
 const s=String(text).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[\u200e\u200f]/g,'').replace(/[٬,]/g,'').replace(/٫/g,'.').replace(/\b(\d{1,3}(?:\.\d{3})+)\b/g,m=>m.replace(/\./g,''));
 if(/\d+\s*[-–]\s*\d+\s*(?:km|كم|كلم)/i.test(s))return null;
 const amount='(\\d+(?:\\.\\d+)?)\\s*(ألف|الف|آلاف|الاف|thousand|k\\b)?\\s*(km\\b|kilomet(?:er|re)s?\\b|كيلومتر|كيلو|كلم|كم)?';
 const label=new RegExp('(?:mileage|odometer|الممشى|الممشي|ممشى|ممشي|ماشي[ةه]?|ماشية|العداد|عداد)\\s*[:：=]?\\s*'+amount,'ig');
 const unit=new RegExp('(?:^|\\s)'+amount,'ig');
 for(const [pattern,labelled] of [[label,true],[unit,false]])for(const m of s.matchAll(pattern)){
  if(!labelled&&!m[3])continue;
  if(!labelled&&/(?:ضمان|كفالة|warranty|service interval|تغيير الزيت|صيانة)\s*[^.;،]{0,35}$/i.test(s.slice(Math.max(0,m.index-50),m.index)))continue;
  const after=s.slice(m.index+m[0].length);
  if(/^\s*(?:\/\s*(?:l\b|liter|لتر)|[-–]\s*\d)/i.test(after))continue;
  const n=Number(m[1])*(m[2]?1000:1);
  if(!Number.isInteger(n)||n<0||n>2000000)continue;
  if(!m[2]&&!m[3]&&n>0&&n<1000)continue;
  return n;
 }
 return null;
}
