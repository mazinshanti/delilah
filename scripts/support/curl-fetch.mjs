// Optional benchmark transport for workspaces where Node fetch cannot use the network proxy.
// No redirect following here: createMarketDetailReader validates each redirect itself.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const exec=promisify(execFile);
export async function curlFetch(url,options={}){
 const folder=await mkdtemp(join(tmpdir(),'dalelah-http-'));
 try{
  const args=['--silent','--show-error','--max-time','20','--max-filesize','5000000','--dump-header',join(folder,'headers'),'--output',join(folder,'body')];
  for(const [key,value] of Object.entries(options.headers||{}))args.push('--header',`${key}: ${value}`);
  args.push(String(url));await exec('curl',args,{signal:options.signal,maxBuffer:100000});
  const raw=await readFile(join(folder,'headers'),'utf8');
  const block=raw.trim().split(/\r?\n\r?\n/).filter(x=>/^HTTP\//.test(x)).at(-1);
  const status=Number(block?.match(/^HTTP\/\S+ (\d{3})/)?.[1]);if(!status)throw Error('invalid-http-response');
  const headers=new Headers();for(const line of block.split(/\r?\n/).slice(1)){const i=line.indexOf(':');if(i>0)headers.append(line.slice(0,i),line.slice(i+1).trim());}
  return new Response([204,205,304].includes(status)?null:await readFile(join(folder,'body')),{status,headers});
 }finally{await rm(folder,{recursive:true,force:true});}
}
