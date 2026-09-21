import express from 'express';
import {createIntentEngine} from '../lib/ai-search-intent.js';
import {installOnDemandRoutes} from '../lib/on-demand/routes.js';
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'16kb'}));
const intentEngine=createIntentEngine();
installOnDemandRoutes(app,{intentEngine});
app.get('/health',(_req,res)=>res.json({ok:true,preview:true,commit:process.env.RENDER_GIT_COMMIT||null,node:process.version,mode:process.env.DALELAH_ON_DEMAND_PROVIDER,configured:{brave:Boolean(process.env.BRAVE_SEARCH_API_KEY||process.env.BRAVE_API_KEY),openai:Boolean(process.env.OPENAI_API_KEY),tavily:Boolean(process.env.TAVILY_API_KEY)}}));
app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Isolated on-demand preview listening'));
