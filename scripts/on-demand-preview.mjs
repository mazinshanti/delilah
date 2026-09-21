import {createIntentEngine} from '../lib/ai-search-intent.js';
import {createPreviewApp} from '../lib/on-demand/preview-app.js';
const {app,service}=createPreviewApp({intentEngine:createIntentEngine()});
const server=app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Isolated on-demand preview listening'));
process.on('SIGTERM',()=>{service.close();server.close();setTimeout(()=>process.exit(0),5000).unref();});
