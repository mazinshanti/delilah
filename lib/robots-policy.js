// RFC-style longest matching path rule, with specific user-agent preference.
// Unknown/unavailable robots must be handled by the caller as a crawl failure.
export function robotsPolicy(text,url,agent='dalelah'){
 const groups=[];let group=null,hasRules=false;
 for(const raw of text.split(/\r?\n/)){
  const line=raw.replace(/#.*/,'').trim(),i=line.indexOf(':');if(i<0)continue;
  const key=line.slice(0,i).trim().toLowerCase(),value=line.slice(i+1).trim();
  if(key==='user-agent'){if(!group||hasRules){group={agents:[],rules:[],delay:0};groups.push(group);hasRules=false;}group.agents.push(value.toLowerCase());}
  else if(group&&['allow','disallow','crawl-delay'].includes(key)){hasRules=true;if(key==='crawl-delay')group.delay=Math.max(0,Number(value)||0);else if(value)group.rules.push({allow:key==='allow',path:value});}
 }
 const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&agent.toLowerCase().includes(a)));
 const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
 const u=new URL(url),path=u.pathname+u.search;
 const matches=selected.flatMap(g=>g.rules).filter(r=>{const pattern=r.path.replace(/[.+?^{}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*');return new RegExp('^'+pattern).test(path);}).sort((a,b)=>b.path.replace(/[*$]/g,'').length-a.path.replace(/[*$]/g,'').length||Number(b.allow)-Number(a.allow));
 return {allowed:matches[0]?.allow??true,delayMs:Math.max(1100,...selected.map(g=>g.delay*1000))};
}
