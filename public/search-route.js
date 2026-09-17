// Shared routing hint: semantics, never language alone. No provider configuration.
export const routingText=value=>String(value||'').normalize('NFKC')
 .replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي')
 .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).toLowerCase()
 .replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim().replace(/\s+/g,' ');
const english=/\b(?:want|find|show|looking|something|best|better|family|families|sporty|comfortable|comfort|reliable|reliability|maintenance|maintain|cheaper|cheap|affordable|luxury|luxurious|economical|efficient|spacious|practical|powerful|japanese|german|chinese|korean|american|european|british|no|not|except|without|suv|electric|hybrid|like|similar|instead|alternative|but|travel|trips|value for money)\b/;
// Token boundaries avoid شي matching inside ميتسوبيشي; prefixes cover وصيانته.
const arabic=/^(?:و|ف)?(?:ابي|ابغي|اريد|ادور|احتاج|شي|شيء|شئ|افضل|مثل|زي|شبيه[هة]?|بديل|لكن|بس|بدون|ياباني[هة]?|الماني[هة]?|كوري[هة]?|امريكي[هة]?|صيني[هة]?|عائلي[هة]?|للعيال|للعائل[هة]|للسفر|مشاوير|مريح[هة]?|اقتصادي[هة]?|اعتمادي[هة]?|رخيص[هة]?|غالي[هة]?|فخم[هة]?|رياضي[هة]?|شبابي[هة]?|قوي[هة]?|عملي[هة]?|واسع[هة]?|مناسب[هة]?|صيان\S*|بالصيان\S*|صرفي\S*|بنزين\S*)$/;
const phrases=/(?:^| )(?:وش تنصح|وش الافضل|ما ابي|ما ابغي|ماابغي|ماابي|مو غالي[هة]?|ما تكلف\S*|قطعها رخيص[هة]?|غير صيني[هة]?|مناسب للعائل[هة]|افضل خيار|فل كامل)(?: |$)/;
export function needsAI(query){
 const q=routingText(query);if(!q||q==='all cars')return false;
 if(english.test(q)||phrases.test(q)||q.split(' ').some(token=>arabic.test(token)))return true;
 // Ambiguous Saudi shorthand needs interpretation; explicit 100k / 100 ألف does not.
 return /(?:اقل من|تحت)\s+\d{1,3}(?!\d)(?!\s*(?:الف|k)(?: |$))(?:\s|$)/.test(q);
}
