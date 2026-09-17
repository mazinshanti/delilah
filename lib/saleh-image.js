const UI_ASSET=/(?:\/flags\/|logo|icon|avatar|placeholder|banner|badge|google\s*play|app\s*store|tiktok|instagram|snapchat|whatsapp|no-comments|not\s*found)/i;
const VEHICLE_HOST=/(?:^|\.)saleh-platform-eu\.s3\.eu-central-1\.amazonaws\.com$/i;

function clean(value=''){
  return String(value||'')
    .replace(/&amp;/gi,'&')
    .replace(/\\u0026/gi,'&')
    .replace(/\\u002f/gi,'/')
    .replace(/\\u003a/gi,':')
    .trim();
}

function attr(tag,name){
  return new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`,'i').exec(tag)?.[1]||'';
}

function textNorm(value=''){
  return String(value||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
}

function unwrap(raw='',base='https://www.salehcars.com'){
  const source=clean(raw);
  if(!source)return null;
  try{
    const outer=new URL(source,base);
    if(outer.pathname==='/_next/image'){
      const nested=outer.searchParams.get('url');
      if(nested)return new URL(clean(nested),base).href;
    }
    return outer.href;
  }catch{return null;}
}

export function isSalehUiImage(url='',alt=''){
  const u=clean(url),a=clean(alt);
  return !u||UI_ASSET.test(`${u} ${a}`)||/\.svg(?:$|\?)/i.test(u)||/\/_next\/static\//i.test(u);
}

function titleOverlap(title='',alt=''){
  const wanted=new Set(textNorm(title).split(' ').filter(x=>x.length>=3&&!/^20\d{2}$/.test(x)));
  if(!wanted.size)return 0;
  const got=textNorm(alt).split(' ');
  let hits=0;for(const token of got)if(wanted.has(token))hits++;
  return hits;
}

function score(url,alt,title,raw){
  if(isSalehUiImage(url,alt))return -1e9;
  let n=0;
  try{
    const u=new URL(url);
    if(VEHICLE_HOST.test(u.hostname))n+=100;
    if(/\/media\//i.test(u.pathname))n+=25;
    if(/\.(?:jpe?g|webp|avif)(?:$|\?)/i.test(u.pathname))n+=30;
    else if(/\.png(?:$|\?)/i.test(u.pathname))n+=12;
  }catch{return -1e9;}
  const overlap=titleOverlap(title,alt);
  if(overlap)n+=Math.min(45,overlap*15);
  if(/^https?:\/\//i.test(clean(raw)))n+=8;
  return n;
}

export function extractSalehVehicleGallery(html='',base='https://www.salehcars.com',options={}){
  const title=String(options.title||'');
  const gallery=[];
  function add(raw,alt='',scoped=false){
    const url=unwrap(raw,base);if(!url||!/^https?:\/\//i.test(url)||isSalehUiImage(url,alt))return;
    // A CDN host alone does not prove that an image belongs to this vehicle.
    if(!scoped&&!titleOverlap(title,alt))return;
    if(!gallery.includes(url))gallery.push(url);
  }
  function images(value){if(Array.isArray(value))value.forEach(images);else if(value&&typeof value==='object')images(value.url||value.contentUrl||value.src);else if(typeof value==='string')add(value,'',true);}
  function walk(v){
    if(!v||typeof v!=='object')return;
    if([v['@type']].flat().some(t=>['Car','Vehicle','Product'].includes(t))){
      if(v.url){try{if(new URL(v.url,base).pathname.replace(/\/$/,'')!==new URL(base).pathname.replace(/\/$/,''))return;}catch{return;}}
      else if(!titleOverlap(title,v.name||''))return;
      images(v.image);return;
    }
    for(const c of Object.values(v))if(c&&typeof c==='object')Array.isArray(c)?c.forEach(walk):walk(c);
  }
  for(const m of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]));}catch{}}
  for(const m of String(html).matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0],alt=clean(attr(tag,'alt')||attr(tag,'title'));
    const sources=[];
    for(const key of ['data-original','data-src','data-lazy-src','src']){const v=attr(tag,key);if(v)sources.push(v);}
    for(const key of ['data-srcset','srcset']){
      const variants=clean(attr(tag,key)).split(',').map(p=>{const [url,size]=p.trim().split(/\s+/);return{url,size:parseFloat(size)||0};}).sort((a,b)=>b.size-a.size);
      if(variants[0]?.url)sources.unshift(variants[0].url);
    }
    for(const raw of sources){const before=gallery.length;add(raw,alt);if(gallery.length>before||gallery.includes(unwrap(raw,base)))break;}
  }
  return gallery.slice(0,40);
}
export function extractSalehVehicleImage(html,base,options){return extractSalehVehicleGallery(html,base,options)[0]||null;}
