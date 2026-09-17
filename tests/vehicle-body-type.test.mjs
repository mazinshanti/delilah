import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveBodyType,normalizeBodyType,bodyTypeEvidence} from '../lib/vehicle-body-type.js';
import {applyIntentConstraints,emptyIntent} from '../lib/ai-search-intent.js';
import {strictDirectListings} from '../lib/direct-search.js';
const cases={Toyota:{Camry:'sedan',Corolla:'sedan',RAV4:'SUV','Land Cruiser':'SUV',Fortuner:'SUV',Prado:'SUV',Hilux:'pickup'},Nissan:{Patrol:'SUV','X-Trail':'SUV',Pathfinder:'SUV'},Honda:{'CR-V':'SUV',Accord:'sedan'},Mazda:{'CX-5':'SUV','6':'sedan'},Lexus:{RX:'SUV',LX:'SUV',ES:'sedan'},Mitsubishi:{Pajero:'SUV',Outlander:'SUV'},Jeep:{Wrangler:'SUV',Gladiator:'pickup'}};
for(const [make,models]of Object.entries(cases))for(const [model,expected]of Object.entries(models))test(`body resolver: ${make} ${model}`,()=>assert.equal(resolveBodyType({make,model}),expected));
test('body aliases and drivetrain ambiguity',()=>{
 for(const alias of ['SUV','suv','crossover','CUV','جيب','دفع رباعي','كروس اوفر','كروس أوفر','SUV / crossover'])assert.equal(normalizeBodyType(alias),'SUV');
 for(const alias of ['sedan','Sedan','سيدان','saloon'])assert.equal(normalizeBodyType(alias),'sedan');
 for(const alias of ['4x4','4WD','AWD']){assert.equal(normalizeBodyType(alias),null);assert.equal(resolveBodyType({bodyType:alias,title:'Unknown vehicle 4x4'}),null);}
 assert.equal(resolveBodyType({make:'Toyota',model:'Hilux',bodyType:'4x4'}),'pickup');
 assert.equal(resolveBodyType({make:'Toyota',model:'RAV4',bodyType:'4x4'}),'SUV');
});
test('Arabic catalog aliases, normalized model spelling and specific variants',()=>{
 assert.equal(resolveBodyType({title:'تويوتا كامري 2022'}),'sedan');
 assert.equal(resolveBodyType({make:'تويوتا',model:'كورولا'}),'sedan');
 assert.equal(resolveBodyType({make:'Honda',model:'CRV'}),'SUV');
 assert.equal(resolveBodyType({make:'Mazda',model:'CX5'}),'SUV');
 assert.equal(resolveBodyType({make:'Toyota',model:'Land Cruiser',title:'Land Cruiser pickup 4x4'}),'pickup');
 assert.equal(resolveBodyType({make:'Toyota',model:'Corolla Cross'}),'SUV');
 assert.equal(resolveBodyType({make:'Toyota',model:'Corolla',title:'Corolla hatchback'}),'hatchback');
 assert.equal(resolveBodyType({make:'Toyota',model:'Camry',title:'Camry SUV'}),'sedan');
});
test('resolution priority and unknown evidence',()=>{
 assert.deepEqual(bodyTypeEvidence({bodyType:'crossover',title:'Uncatalogued car'}),{bodyType:'SUV',source:'source-body-type'});
 assert.equal(resolveBodyType({title:'Uncatalogued crossover 2022'}),'SUV');
 assert.equal(resolveBodyType({title:'Unknown AWD car'}),null);
 assert.equal(resolveBodyType({title:'SUV sedan comparison'}),null);
});
test('hard SUV query rejects all non-SUV and unknown classes without eliminating soft-unknown SUVs',()=>{
 const fixture=(make,model,extra={})=>({make,model,title:`${make} ${model} 2022`,year:2022,yearVerified:true,condition:'used',price:90000,priceVerified:true,saleVerified:true,url:`https://example.com/fixture/${make}/${model}`,images:['https://example.com/one.jpg','https://example.com/two.jpg'],...extra});
 const rows=[fixture('Toyota','Camry'),fixture('Toyota','Corolla'),fixture('Toyota','RAV4'),fixture('Toyota','Hilux'),fixture('Toyota','Hiace'),fixture('Lexus','CT'),fixture('Toyota','Supra'),fixture('Unknown','Unknown'),fixture('Nissan','Patrol'),fixture('Toyota','RAV4',{price:200000})];
 const i={...emptyIntent(),bodyType:'SUV',originPreference:'Japanese',priorities:['affordable-maintenance','comfort','family'],maxPrice:150000};
 const out=applyIntentConstraints(strictDirectListings(rows,{query:'',condition:'used',filters:{maxPrice:150000}}),i);
 assert.deepEqual(out.map(c=>c.model).sort(),['Patrol','RAV4']);assert(out.every(c=>c.resolvedBodyType==='SUV'));assert(out.every(c=>c.images.length===2));
 assert(out.every(c=>!c.rankingSignals.includes('affordable-maintenance')));
 assert.deepEqual(strictDirectListings(rows,{query:'',condition:'used',filters:{category:'crossover',maxPrice:150000}}).map(c=>c.model).sort(),['Patrol','RAV4']);
 assert.equal(strictDirectListings(rows,{query:'Camry 2022',condition:'used'}).length,1);
});
