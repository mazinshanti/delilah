// Only explicit odometer evidence; never infer mileage from price/year/condition.
export function extractMileage(text=''){
 const s=String(text).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٬,]/g,'').replace(/٫/g,'.').replace(/\b(\d{1,3}(?:\.\d{3})+)\b/g,m=>m.replace(/\./g,''));
 if(/\d+\s*[-–]\s*\d+\s*(?:km|كم|كلم)/i.test(s))return null;
 const label=/(?:mileage|odometer|الممشى|الممشي|ممشى|ممشي|ماشي|العداد|عداد)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(ألف|الف|آلاف|الاف|thousand|k\b)?\s*(km\b|كيلومتر|كيلو|كلم|كم)?/i.exec(s);
 const unit=/(?:^|\s)(\d+(?:\.\d+)?)\s*(ألف|الف|آلاف|الاف|thousand|k\b)?\s*(km\b|كيلومتر|كيلو|كلم|كم)(?:\s|$|[.,])/i.exec(s);
 const m=label||unit;if(!m)return null;
 const n=Number(m[1])*(m[2]?1000:1);
 if(!Number.isFinite(n)||n<0||n>2000000)return null;
 if(!m[2]&&!m[3]&&n>0&&n<1000)return null;
 return n;
}
