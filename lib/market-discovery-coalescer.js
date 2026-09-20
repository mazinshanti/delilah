// Coalesce identical discovery tasks only. Never cache failures or broaden a query.
export function createCoalescedDiscovery(discover,{clock=Date.now,ttlMs=30000,maxEntries=100}={}){
 const pending=new Map(),completed=new Map();
 return async task=>{
  const key=JSON.stringify(task);for(const [k,v]of completed)if(clock()>=v.expiresAt)completed.delete(k);
  if(completed.has(key))return {...structuredClone(completed.get(key).value),webSearchCalls:0,discoveryCacheHit:true};
  if(pending.has(key))return {...structuredClone(await pending.get(key)),webSearchCalls:0,discoveryShared:true};
  const job=Promise.resolve().then(()=>discover(task));pending.set(key,job);
  try{const value=await job;if(value.status==='completed'&&ttlMs>0&&maxEntries>0){while(completed.size>=maxEntries)completed.delete(completed.keys().next().value);completed.set(key,{value:structuredClone(value),expiresAt:clock()+ttlMs});}return value;}
  finally{pending.delete(key);}
 };
}
