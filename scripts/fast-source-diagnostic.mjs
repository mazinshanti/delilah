const UA='Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)';
const targets=[
  ['Y-PLUS','https://www.salehcars.com/en/cars/69a971ec6c4a6fc01fc27229/%D8%AA%D9%88%D9%8A%D9%88%D8%AA%D8%A7-%D9%8A%D8%A7%D8%B1%D8%B3-y-%D8%A8%D9%84%D8%B3-2026',['60900','60,900','70035','70,035']],
  ['Y-LIMITED','https://www.salehcars.com/en/cars/6a3fa477859699adfe95dc9b/toyota-yaris-y-limited-2026',['57900','57,900','66585','66,585']]
];
function snippets(text,tokens){
  const out=[];
  for(const token of tokens){
    let at=0;
    while((at=text.indexOf(token,at))>=0&&out.length<20){out.push({token,at,around:text.slice(Math.max(0,at-180),at+260).replace(/\s+/g,' ')});at+=token.length;}
  }
  for(const re of [/(?:price|amount|vat|cash|sale|final|discount)[^\n\r<>]{0,100}(?:57900|60900|66585|70035)/ig,/(?:57900|60900|66585|70035)[^\n\r<>]{0,100}(?:price|amount|vat|cash|sale|final|discount)/ig]){
    for(const m of text.matchAll(re)){if(out.length>=30)break;out.push({token:'regex',at:m.index,around:m[0].slice(0,500)});}
  }
  return out;
}
for(const [name,url,tokens] of targets){
  try{
    const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(12000),headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.9,ar;q=0.8'}});
    const html=(await r.text()).slice(0,10_000_000);
    console.log('SALEH_PRICE_RAW '+JSON.stringify({name,status:r.status,length:html.length,hasPriceWord:/price/i.test(html),hasSAR:/SAR/i.test(html),snippets:snippets(html,tokens)}));
  }catch(error){console.log('SALEH_PRICE_RAW_ERROR '+JSON.stringify({name,error:error.message}));}
}
