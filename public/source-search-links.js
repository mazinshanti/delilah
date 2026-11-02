// Only link to search URLs that were returned by Dalelah's existing source
// adapters. These links open the original marketplace; they do not imply that
// every listing there is indexed, available, or licensed for reuse in Dalelah.
const SOURCES={
 Haraj:new Set(['haraj.com.sa','www.haraj.com.sa']),
 OpenSooq:new Set(['sa.opensooq.com'])
};
export function externalSearchLinks(sources=[]){
 const links=[],used=new Set();
 for(const source of Array.isArray(sources)?sources:[]){
  const name=String(source?.name||'');
  if(!SOURCES[name]||used.has(name))continue;
  try{
   const u=new URL(String(source?.url||''));
   if(u.protocol!=='https:'||u.username||u.password||!SOURCES[name].has(u.hostname.toLowerCase()))continue;
   if(name==='Haraj'&&!u.pathname.startsWith('/search/'))continue;
   if(name==='OpenSooq'&&!u.pathname.includes('/cars/cars-for-sale/'))continue;
   u.hash='';
   links.push({name,url:u.href});
   used.add(name);
  }catch{}
 }
 return links;
}
