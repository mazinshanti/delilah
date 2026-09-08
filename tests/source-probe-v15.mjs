const targets = [
  ['YallaMotor','https://ksa.yallamotor.com/used-cars?page=1', /\/used-cars\/[^"'<>\s]+\/20\d{2}\/(?:used|new)-[^"'<>\s]+-\d+/gi],
  ['Saudi Sale','https://cars.saudisale.com/en', /\/en\/listings\/[A-Za-z0-9_-]{4,20}\/[^"'<>\s]+/gi],
  ['ArabWheels','https://www.arabwheels.sa/en/used-cars/', /\/en\/used-cars\/[^"'<>\s]+-for-sale-in-[^"'<>\s]+-\d+/gi],
  ['Hatla2ee','https://ksa.hatla2ee.com/en/car/search', /\/en\/(?:new-car|car)\/[^"'<>\s]+\/unit\/\d+/gi]
];
for (const [name,url,re] of targets) {
  try {
    const r = await fetch(url,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 (compatible; DelilahSourceProbe/1.0)','accept':'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(15000)});
    const html = await r.text();
    const matches=[...new Set(html.match(re)||[])].slice(0,8);
    console.log(JSON.stringify({name,status:r.status,final:r.url,contentType:r.headers.get('content-type'),bytes:html.length,matches}));
  } catch(e) { console.log(JSON.stringify({name,error:e?.message||String(e)})); }
}
