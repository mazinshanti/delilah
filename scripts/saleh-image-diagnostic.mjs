const urls=[
'https://www.salehcars.com/en/cars/68e275ca9f8dd76befd9616c/toyota-yaris-y-2026',
'https://www.salehcars.com/en/cars/69a971ec6c4a6fc01fc27229/%D8%AA%D9%88%D9%8A%D9%88%D8%AA%D8%A7-%D9%8A%D8%A7%D8%B1%D8%B3-y-%D8%A8%D9%84%D8%B3-2026'
];
const clean=s=>String(s||'').replace(/&amp;/g,'&');
for(const url of urls){
  const r=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)','Accept':'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.9,ar;q=0.8'},signal:AbortSignal.timeout(12000)});
  const html=(await r.text()).slice(0,8_000_000);
  const metas=[];
  for(const m of html.matchAll(/<meta\b[^>]*(?:property|name)=["']([^"']+)["'][^>]*content=["']([^"']+)["'][^>]*>/gi)){
    if(/image/i.test(m[1]))metas.push({key:m[1],value:clean(m[2])});
  }
  const imgs=[];
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0];
    const src=/(?:src|data-src)=["']([^"']+)["']/i.exec(tag)?.[1]||null;
    const srcset=/(?:srcset|data-srcset)=["']([^"']+)["']/i.exec(tag)?.[1]||null;
    const alt=/alt=["']([^"']*)["']/i.exec(tag)?.[1]||null;
    if(src||srcset)imgs.push({src:clean(src),srcset:clean(srcset),alt});
    if(imgs.length>=12)break;
  }
  const jsonImageTokens=[];
  for(const m of html.matchAll(/["'](?:image|images|mainImage|thumbnail|coverImage|imageUrl|imageURL)["']\s*:\s*["']([^"']+)["']/gi)){
    jsonImageTokens.push(clean(m[1]));
    if(jsonImageTokens.length>=12)break;
  }
  console.log('SALEH_IMAGE_DIAG '+JSON.stringify({url:r.url,status:r.status,length:html.length,metas,imgs,jsonImageTokens}));
}