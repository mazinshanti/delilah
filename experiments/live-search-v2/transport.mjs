import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {identity} from './core.mjs';
const exec=promisify(execFile);
export const HOSTS=new Set(['www.dalelah.co','haraj.com.sa','ksa.carswitch.com','syarah.com','www.salehcars.com']);
export function safeTarget(raw){const u=new URL(raw);if(u.protocol!=='https:'||!HOSTS.has(u.hostname)||u.username||u.password||u.port)throw Error('unsupported-target');return u;}
export function safeRedirect(from,to){const a=safeTarget(from),b=safeTarget(new URL(to,a));if(a.hostname!==b.hostname)throw Error('cross-host-redirect');if(identity(a.href)&&identity(a.href)!==identity(b.href))throw Error('different-ad-redirect');return b.href;}
export function createTransport({maxConcurrent=6,maxPerHost=2,requestMs=20000}={}){
 let active=0;const hosts=new Map(),queue=[],pending=new Map(),stats=[];
 const drain=()=>{for(let n=0;n<queue.length&&active<maxConcurrent;){const task=queue[n];if(task.signal?.aborted){queue.splice(n,1);task.reject(Error('deadline'));continue;}if((hosts.get(task.host)||0)>=maxPerHost){n++;continue;}queue.splice(n,1);active++;hosts.set(task.host,(hosts.get(task.host)||0)+1);task.run().then(task.resolve,task.reject).finally(()=>{active--;hosts.set(task.host,hosts.get(task.host)-1);drain();});}};
 async function raw(url,{body,signal,end=Date.now()+requestMs,hop=0}={}){
  const u=safeTarget(url),remaining=end-Date.now();if(remaining<=0||signal?.aborted)throw Error('deadline');
  const began=Date.now(),args=['-sS','--include','--max-time',String(Math.max(0.1,remaining/1000)),'--max-filesize','4000000','--write-out','\n%{http_code}','-A','Dalelah/1.5 (+https://dalelah.co; live-search-experiment)'];
  if(body)args.push('-H','Content-Type: application/json','--data-binary',JSON.stringify(body));args.push(u.href);
  let stdout;try{({stdout}=await exec('curl',args,{maxBuffer:4100000,signal,timeout:remaining+500}));}catch{stats.push({host:u.hostname,ms:Date.now()-began,error:signal?.aborted?'deadline':'transport-error'});throw Error(signal?.aborted?'deadline':'transport-error');}
  const split=stdout.lastIndexOf('\n'),status=Number(stdout.slice(split+1));let text=stdout.slice(0,split),header='';
  while(text.startsWith('HTTP/')){const at=text.indexOf('\r\n\r\n');if(at<0)throw Error('invalid-headers');header=text.slice(0,at);text=text.slice(at+4);}
  stats.push({host:u.hostname,status,bytes:Buffer.byteLength(text),ms:Date.now()-began});
  if([301,302,303,307,308].includes(status)){if(hop>=3)throw Error('redirect-limit');const loc=header.match(/^location:\s*(.+)$/im)?.[1]?.trim();if(!loc)throw Error('redirect-without-location');return raw(safeRedirect(u.href,loc),{body,signal,end,hop:hop+1});}
  if(status!==200)throw Error('http-'+status);
  if(text.length<5000&&/403 Forbidden|Access Denied|verify you are human/i.test(text))throw Error('access-blocked');
  return {text,url:u.href,status};
 }
 function get(url,{body,signal}={}){
  const u=safeTarget(url),key=JSON.stringify([u.href,body]);if(pending.has(key))return pending.get(key);
  const promise=new Promise((resolve,reject)=>{queue.push({host:u.hostname,signal,resolve,reject,run:()=>raw(u.href,{body,signal})});drain();}).finally(()=>pending.delete(key));pending.set(key,promise);return promise;
 }
 return {get,stats};
}
