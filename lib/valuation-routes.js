import {matchValuationTrims} from './valuation-trim-assist.js';
import {validateValuationInput,valueVehicle} from './vehicle-valuation.js';
export function installValuationRoutes(app,{inventoryIndex}){
 app.post('/api/car-valuation',async(req,res)=>{
  const started=performance.now(),v=validateValuationInput(req.body);if(!v.ok)return res.status(400).json({error:'invalid-vehicle',fields:v.fields});
  try{const records=inventoryIndex.fresh(),assist=await matchValuationTrims(v.value,records);const result=valueVehicle(records,v.value,{snapshotAt:inventoryIndex.generatedAt,...assist});res.setHeader('Server-Timing',`valuation;dur=${(performance.now()-started).toFixed(1)}`);res.json(result);}catch{res.status(503).json({error:'valuation-unavailable'});}
 });
}
