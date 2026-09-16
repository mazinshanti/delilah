export function validateFilters(filters={}){
 if(!filters||typeof filters!=='object'||Array.isArray(filters))return 'invalid-filters';
 const numeric=['minYear','maxYear','minPrice','maxPrice','maxMileage'];
 for(const key of numeric){const v=filters[key];if(v==null||v==='')continue;if(!Number.isFinite(Number(v))||Number(v)<0)return `invalid-${key}`;if(/Year/.test(key)&&(Number(v)<1980||Number(v)>new Date().getFullYear()+1))return `invalid-${key}`;}
 if(filters.minYear&&filters.maxYear&&Number(filters.minYear)>Number(filters.maxYear))return 'invalid-year-range';
 if(filters.minPrice&&filters.maxPrice&&Number(filters.minPrice)>Number(filters.maxPrice))return 'invalid-price-range';
 for(const [key,v] of Object.entries(filters))if(!numeric.includes(key)&&(typeof v!=='string'||v.length>100))return `invalid-${key}`;
 return null;
}
export function installApiGuard(app){
 app.disable('x-powered-by');app.set('trust proxy',1);
 const clients=new Map();
 app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' https: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if(!req.path.startsWith('/api/'))return next();
  res.setHeader('Cache-Control','no-store');
  const now=Date.now(),key=req.ip||'unknown';let entry=clients.get(key);
  if(!entry||now-entry.at>60_000){entry={at:now,n:0};clients.set(key,entry);}
  if(++entry.n>240){res.setHeader('Retry-After','60');return res.status(429).json({error:'Too many requests. Please retry shortly.'});}
  if(clients.size>10000)for(const[k,v]of clients)if(now-v.at>60_000)clients.delete(k);
  if(clients.size>15000)return res.status(503).json({error:'Service busy. Please retry shortly.'});
  next();
 });
 const timer=setInterval(()=>{const now=Date.now();for(const[k,v]of clients)if(now-v.at>60_000)clients.delete(k);},60_000);timer.unref();
}
