import {imageUrls} from '../public/vehicle-media.js';
import {robotsPolicy} from './robots-policy.js';
const decode=s=>String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"');
export function extractListingGallery(html,url){
 const images=[];
 function walk(v){if(!v||typeof v!=='object')return;const types=[v['@type']].flat();if(types.some(t=>['Product','Car','Vehicle'].includes(t))){if(v.url){try{const a=new URL(v.url,url),b=new URL(url);if(a.hostname!==b.hostname||(b.hostname==='haraj.com.sa'?a.pathname.split('/')[1]!==b.pathname.split('/')[1]:a.pathname.replace(/\/$/,'')!==b.pathname.replace(/\/$/,'')))return;}catch{return;}}images.push(...imageUrls(v.image));return;}for(const child of Object.values(v)){if(Array.isArray(child))child.forEach(walk);else if(child&&typeof child==='object')walk(child);}}
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(m[1]));}catch{}}
 // Only original-listing metadata, never recommendation-card image arrays.
 if(!images.length)for(const m of html.matchAll(/<meta\b[^>]*>/gi)){const tag=m[0];if(!/(?:property|name)=["']og:image["']/i.test(tag))continue;const src=tag.match(/content=["']([^"']+)["']/i)?.[1];if(src)images.push(decode(src));}
 const gallery=imageUrls(images);
 return new URL(url).hostname.endsWith('haraj.com.sa')?gallery.filter(x=>/^https:\/\/[^/]*haraj\.com\.sa\/userfiles/i.test(x)):gallery;
}
const cache=new Map(),pending=new Map(),robotsCache=new Map();
export function eligibleGalleryUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&((u.hostname==='haraj.com.sa'&&/^\/\d{8,}(?:\/|$)/.test(u.pathname))||(u.hostname==='syarah.com'&&/^\/(?:en\/)?cardetail\//.test(u.pathname))||(u.hostname==='ksa.carswitch.com'&&/\/used-car\//.test(u.pathname)));}catch{return false;}}
async function get(url,timeout=9000){
 const origin=new URL(url).origin,signal=AbortSignal.timeout(timeout);let current=url,r;
 for(let hop=0;hop<3;hop++){r=await fetch(current,{redirect:'manual',headers:{'User-Agent':'Dalelah/1.5 (+https://dalelah.co; vehicle-search-index)'},signal});if(r.status<300||r.status>=400)break;const location=r.headers.get('location');if(!location)throw Error('missing-redirect-location');const next=new URL(location,current);if(next.origin!==origin||next.username||next.password||!(eligibleGalleryUrl(next.href)||next.pathname==='/robots.txt'))throw Error('unsafe-source-redirect');await r.body?.cancel();current=next.href;}
 if(!r.ok)throw Error('HTTP '+r.status);const reader=r.body.getReader();let n=0,parts=[];while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>4_000_000){await reader.cancel();throw Error('source-too-large');}parts.push(Buffer.from(value));}return Buffer.concat(parts).toString('utf8');
}
export async function publicListingHtml(url,timeout=9000){
 if(!eligibleGalleryUrl(url))throw Error('unsupported-listing-url');
 const origin=new URL(url).origin;let rules=robotsCache.get(origin);if(!rules||Date.now()-rules.at>3600000){rules={text:await get(origin+'/robots.txt',timeout),at:Date.now()};robotsCache.set(origin,rules);}
 const policy=robotsPolicy(rules.text,url);if(!policy.allowed)throw Error('source-disallows-indexing');if(policy.delayMs>10000)throw Error('source-delay-exceeds-interactive-budget');if(policy.delayMs)await new Promise(r=>setTimeout(r,policy.delayMs));return get(url,timeout);
}
export async function discoverListingGallery(url){
 if(!eligibleGalleryUrl(url))throw Error('unsupported-listing-url');
 const found=cache.get(url);if(found&&Date.now()-found.at<600000)return found.images;
 if(pending.has(url))return pending.get(url);if(pending.size>=12)throw Error('gallery-busy');
 const promise=(async()=>{const images=extractListingGallery(await publicListingHtml(url),url);if(cache.size>500)cache.delete(cache.keys().next().value);cache.set(url,{images,at:Date.now()});return images;})();pending.set(url,promise);try{return await promise;}finally{pending.delete(url);}
}
