import {normalizeInventoryListing} from './inventory-normalizer.js';
import {isVehicleSaleListing} from './listing-quality.js';

// Dealer-owned domains only. Marketplace-wide access requires a separate
// agreement and adapter; an operator cannot self-authorize platform content.
const PLATFORM_HOSTS=new Set(['haraj.com.sa','www.haraj.com.sa','haraj.com','www.haraj.com',
  'sa.opensooq.com','dubizzle.sa','www.dubizzle.sa']);
const validHost=h=>/^[a-z0-9][a-z0-9.-]{2,252}$/.test(h)&&!h.endsWith('.');
function sourceUrl(value,hosts){
 try{
  const u=new URL(String(value||''));
  if(u.protocol!=='https:'||u.username||u.password||!hosts.has(u.hostname.toLowerCase()))return null;
  u.hash='';
  for(const key of [...u.searchParams.keys()])if(/^utm_/i.test(key)||/^(fbclid|gclid)$/i.test(key))u.searchParams.delete(key);
  return u.href.replace(/\/$/,'');
 }catch{return null}
}
function assertManifest(manifest={}){
 const name=String(manifest.source||'').trim();
 const grant=manifest.authorization||{};
 const domains=Array.isArray(manifest.authorizedDomains)?manifest.authorizedDomains:[];
 if(!name||name.length>100||domains.length<1||domains.length>12)throw Error('invalid-feed-source-or-domains');
 const hosts=new Set(domains.map(x=>String(x||'').trim().toLowerCase()));
 if([...hosts].some(h=>!validHost(h)||PLATFORM_HOSTS.has(h)||h.endsWith('.haraj.com.sa')))throw Error('platform-or-invalid-domain-not-permitted');
 if(grant.indexingApproved!==true||grant.displayApproved!==true||
   !String(grant.agreementReference||'').trim()||!String(grant.grantedBy||'').trim())
   throw Error('partner-permission-evidence-required');
 if(grant.validUntil){
   const expiry=Date.parse(grant.validUntil);
   if(!Number.isFinite(expiry)||expiry<=Date.now())throw Error('partner-permission-expired');
 }
 return {name,hosts,reference:String(grant.agreementReference).trim()};
}

/**
 * Process only a partner-supplied JSON feed, never a marketplace web scrape.
 * Manifest contents are operator attestations, not independent verification of
 * legal rights. Feed price evidence remains visibly partner supplied.
 */
export function prepareAuthorizedDealerFeed(feed={},manifest={}){
 const {name,hosts,reference}=assertManifest(manifest);
 const input=Array.isArray(feed)?feed:feed.listings;
 if(!Array.isArray(input)||input.length>5000)throw Error('invalid-feed-list');
 const byUrl=new Map(),rejected={},seen=new Set();
 let duplicateUrls=0;
 const reject=reason=>{rejected[reason]=(rejected[reason]||0)+1};
 for(const raw of input){
   if(!raw||typeof raw!=='object'||Array.isArray(raw)){reject('invalid-record');continue;}
   const url=sourceUrl(raw.url||raw.originalUrl||raw.listingUrl,hosts);
   if(!url){reject('unapproved-listing-domain');continue;}
   const price=Number(raw.priceSar??raw.price_sar??raw.price);
   const year=Number(raw.year);
   if(!Number.isInteger(year)||year<1980||year>new Date().getFullYear()+1 ||
       !Number.isFinite(price)||price<=1000||price>10000000 ||
       !['new','used'].includes(raw.condition) ||
       String(raw.currency||'SAR')!=='SAR'){
       reject('missing-or-invalid-vehicle-facts');continue;
   }
   const record=normalizeInventoryListing({
     ...raw,source:name,sourceType:'dealer-feed',sourceCategory:'cars for sale',
     url,price,priceSar:price,priceVerified:true,
     priceSource:'authorized-dealer-feed',priceEvidence:'partner-supplied',
     ingestionMethod:'authorized-partner-json',
     sellerVerified:false,year,
     lastSeenAt:new Date().toISOString()
   });
   if(!isVehicleSaleListing(record)){reject('not-verified-car-sale');continue;}
   if(seen.has(url))duplicateUrls++;
   seen.add(url);
   byUrl.set(url,record);
 }
 return {source:name,authorizationReference:reference,
   records:[...byUrl.values()],
   report:{source:name,submitted:input.length,accepted:byUrl.size,
     duplicateUrls,rejected,rightsVerification:'operator-attested-not-independently-verified'}};
}
