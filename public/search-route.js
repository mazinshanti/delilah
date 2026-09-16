// Shared routing hint only. No provider code or credentials are sent to the browser.
export function needsAI(query){
 const q=String(query||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));if(!q||q==='__all_cars__')return false;
 return /\b(?:want|find|show|looking|something|best|family|sporty|comfortable|reliable|maintenance|maintain|cheaper|cheap|luxury|japanese|german|chinese|korean|no|not|except|without|suv|electric|hybrid|like|similar|instead|alternative)\b|ابي|أبي|ابغى|أبغى|اريد|أريد|عائلي|شبابي|صيان|اقتصادي|رياضي|ياباني|الماني|ألماني|صيني|بدون|فل كامل|مثل|بديل|زي\s|(?:اقل من|أقل من|تحت)\s*\d{1,3}(?:\s|$)/i.test(q)||(/[a-z]/i.test(q)&&/[\u0600-\u06ff]/.test(q));
}
