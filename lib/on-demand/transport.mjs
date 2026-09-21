import {fetch as pooledFetch,EnvHttpProxyAgent} from 'undici';
import {identity} from './core.mjs';
export const HOSTS=new Set(['www.dalelah.co','sa.opensooq.com','www.mercedes-benz-mena.com','buy.kayishha.com','www.mstaml.com','haraj.com.sa','ksa.carswitch.com','syarah.com','www.salehcars.com','cars.saudisale.com','ksa.motory.com','www.samaco.com.sa','www.arabwheels.sa']);
export function safeTarget(raw){const u=new URL(raw);if(u.protocol!=='https:'||!HOSTS.has(u.hostname)||u.username||u.password||u.port)throw Error('unsupported-target');return u;}
export function safeRedirect(from,to){const a=safeTarget(from),b=safeTarget(new URL(to,a));if(a.hostname!==b.hostname)throw Error('cross-host-redirect');if(identity(a.href)&&identity(a.href)!==identity(b.href))throw Error('different-ad-redirect');return b.href;}
export function createTransport({maxConcurrent=6,maxPerHost=2,requestMs=20000,fetchImpl=pooledFetch}={}){
 const dispatcher=new EnvHttpProxyAgent({connections:maxPerHost,pipelining:1,connectTimeout:requestMs,keepAliveTimeout:60000,keepAliveMaxTimeout:60000});
 const signals=new WeakMap();let nextSignalId=0;
 let active=0;const hosts=new Map(),queue=[],pending=new Map(),stats=[];
 const record=value=>{stats.push(value);if(stats.length>1000)stats.shift();};
 const drain=()=>{for(let n=0;n<queue.length&&active<maxConcurrent;){const task=queue[n];if(task.signal?.aborted){queue.splice(n,1);task.reject(Error('deadline'));continue;}if((hosts.get(task.host)||0)>=maxPerHost){n++;continue;}queue.splice(n,1);active++;hosts.set(task.host,(hosts.get(task.host)||0)+1);task.run().then(task.resolve,task.reject).finally(()=>{active--;hosts.set(task.host,hosts.get(task.host)-1);drain();});}};
 async function raw(url,{body,signal,permit,end=Date.now()+requestMs,hop=0}={}){
  const u=safeTarget(url),remaining=end-Date.now();if(permit&&!permit(u.href))throw Error('robots-disallowed');if(remaining<=0||signal?.aborted)throw Error('deadline');
  const began=Date.now(),timeout=AbortSignal.timeout(Math.max(1,remaining));
  const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
  let response,text='',bytes=0;
  try{
   response=await fetchImpl(u.href,{dispatcher,signal:requestSignal,redirect:'manual',method:body?'POST':'GET',headers:{'user-agent':'Dalelah/1.5 (+https://dalelah.co; live-search-experiment)',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
   // Check redirects before reading/following them. No automatic retries or bypass.
   if([301,302,303,307,308].includes(response.status)){
    await response.body?.cancel();
    record({host:u.hostname,status:response.status,bytes:0,ms:Date.now()-began});
    if(hop>=3)throw Error('redirect-limit');const loc=response.headers.get('location');if(!loc)throw Error('redirect-without-location');
    return raw(safeRedirect(u.href,loc),{body,signal,permit,end,hop:hop+1});
   }
   if(response.status!==200){await response.body?.cancel();throw Error('http-'+response.status);}
   const chunks=[];
   for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>4000000)throw Error('response-too-large');chunks.push(Buffer.from(chunk));}
   text=Buffer.concat(chunks).toString('utf8');
  }catch(e){const error=signal?.aborted||timeout.aborted?'deadline':/^(http-|response-too-large|redirect-|cross-host-|different-ad-|unsupported-target)/.test(e.message)?e.message:'transport-error';record({host:u.hostname,status:response?.status,ms:Date.now()-began,error});throw Error(error);}
  const status=response.status;
  record({host:u.hostname,status,bytes,ms:Date.now()-began});
  if(status!==200)throw Error('http-'+status);
  if(text.length<5000&&/403 Forbidden|Access Denied|verify you are human/i.test(text))throw Error('access-blocked');
  return {text,url:u.href,status};
 }
 function get(url,{body,signal,permit,priority=0}={}){
  const u=safeTarget(url),key=JSON.stringify([u.href,body,signal?(signals.has(signal)?signals.get(signal):(signals.set(signal,++nextSignalId),nextSignalId)):0]);if(pending.has(key))return pending.get(key);
  const promise=new Promise((resolve,reject)=>{queue.push({host:u.hostname,signal,resolve,reject,priority,run:()=>raw(u.href,{body,signal,permit})});queue.sort((a,b)=>b.priority-a.priority);drain();}).finally(()=>pending.delete(key));pending.set(key,promise);return promise;
 }
 return {get,stats,close:()=>dispatcher.destroy()};
}
