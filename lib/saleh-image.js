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
  return new RegExp(`${name}=["']([^"']*)["']`,'i').exec(tag)?.[1]||'';
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

export function extractSalehVehicleImage(html='',base='https://www.salehcars.com',options={}){
  const title=String(options.title||'');
  const candidates=[];
  for(const m of String(html||'').matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0],alt=clean(attr(tag,'alt'));
    const rawSources=[];
    for(const key of ['src','data-src']){const v=attr(tag,key);if(v)rawSources.push(v);}
    for(const key of ['srcset','data-srcset']){
      const v=attr(tag,key);if(!v)continue;
      for(const part of clean(v).split(',')){
        const src=part.trim().split(/\s+/)[0];if(src)rawSources.push(src);
      }
    }
    for(const raw of rawSources){
      const url=unwrap(raw,base);if(!url)continue;
      candidates.push({url,score:score(url,alt,title,raw)});
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0]?.score>0?candidates[0].url:null;
}
