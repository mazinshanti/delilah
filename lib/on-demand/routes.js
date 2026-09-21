import {timingSafeEqual} from 'node:crypto';
import {createTransport} from './transport.mjs';
import {provider} from './providers.mjs';
import {scheduledSources} from './study.mjs';
import {createOnDemandService} from './service.js';
export function installOnDemandRoutes(app,{env=process.env,intentEngine,service:injected}={}){
 if(env.DALELAH_ON_DEMAND_ENABLED!=='true')return null;
 const token=env.DALELAH_ON_DEMAND_TOKEN;if(!token||token.length<32)throw Error('on-demand-requires-private-preview-token');
 const name=env.DALELAH_ON_DEMAND_PROVIDER||'tavily';if(!['brave','tavily','direct'].includes(name))throw Error('invalid-on-demand-provider');
 let providerCalls=0,providerErrors=0,windowAt=Date.now();const hosted=name==='direct'?null:provider(name,{env});if(!injected&&name!=='direct'&&!hosted)throw Error('on-demand-provider-key-missing');
 const limited=hosted?async(i,o)=>{if(Date.now()-windowAt>=3600000){windowAt=Date.now();providerCalls=0;}if(providerCalls>=20)throw Error('provider-budget-exhausted');providerCalls++;try{return await hosted(i,o);}catch{providerErrors++;throw Error('hosted-search-unavailable');}}:null;
 const service=injected||createOnDemandService({intentEngine,adapters:scheduledSources(createTransport(),{webDiscovery:limited})});
 const authorize=(req,res,next)=>{res.setHeader('Cache-Control','no-store');const actual=Buffer.from(req.get('authorization')||''),expected=Buffer.from('Bearer '+token);if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return res.status(401).json({error:'unauthorized'});next();};
 const root='/api/search/on-demand';
 app.post(root,authorize,(req,res)=>{const out=service.start(req.body);if(out.retryAfter)res.setHeader('Retry-After',String(out.retryAfter));res.status(out.statusCode).json(out);});
 app.get(root+'/metrics',authorize,(_req,res)=>res.json({...service.metrics(),provider:name,providerCalls,providerErrors,limits:{active:2,requestsPerHour:100,providerCallsPerHour:20},scope:'single-process-preview'}));
 app.get(root+'/:id',authorize,(req,res)=>{const result=service.get(req.params.id);res.status(result?200:404).json(result||{error:'search-expired'});});
 app.delete(root+'/:id',authorize,(req,res)=>res.status(service.cancel(req.params.id)?200:404).json({cancelled:true}));
 return service;
}
