import test from 'node:test';import assert from 'node:assert/strict';
import {identity} from '../lib/on-demand/core.mjs';
import {safeTarget,safeRedirect} from '../lib/on-demand/transport.mjs';
import {createSources,schemaCars} from '../lib/on-demand/sources.mjs';
import {allSources} from '../lib/on-demand/study.mjs';
import {leads} from '../lib/on-demand/providers.mjs';
import {SOURCE_REGISTRY} from '../lib/source-registry.js';
const urls=['https://sa.opensooq.com/en/search/123456789','https://www.mercedes-benz-mena.com/ksa/en/buy-used/12345-mercedes-c200/','https://buy.kayishha.com/cars/details/toyota-corolla-2022-12345','https://www.mstaml.com/sa/product/toyota?id=1234567&type=4.41'];
test('four additional existing adapters share strict URL identities and trusted hosts',()=>{
 for(const url of urls){assert.ok(identity(url));assert.ok(safeTarget(url));assert.equal(identity(url.replace('https:','http:')),null);assert.throws(()=>safeRedirect(url,'https://evil.test/a'));}
 assert.equal(new Set(allSources).size,12);assert.equal(leads(urls.map(url=>({url}))).length,4);
 assert.equal(identity('https://www.mercedes-benz-mena.com/uae/en/buy-used/12345-mercedes/'),null);
 assert.equal(identity('https://www.mstaml.com/sa/product/car?id=1234567&id=7654321'),null);
});
test('nested offers bind exact ad, preserve condition and reject sold and foreign-currency prices',async()=>{
 const source=SOURCE_REGISTRY.find(s=>s.id==='mercedes'),url=urls[1];
 const car={'@type':'Car',name:'Mercedes C200 2022',brand:{name:'Mercedes'},model:'C200',vehicleModelDate:2022,itemCondition:'UsedCondition',mileageFromOdometer:{value:20000}};
 const offer={'@type':'Offer',url,price:120000,priceCurrency:'SAR',availability:'https://schema.org/InStock',itemOffered:car};
 const html=o=>'<script type="application/ld+json">'+JSON.stringify(o)+'</script>';
 const transport={get:async u=>({url:u,text:u.endsWith('/robots.txt')?'User-agent: *\nAllow: /':html(offer)})};
 const result=await createSources(transport).verify({source:source.name,url},{});assert.equal(result.length,1);assert.equal(result[0].detailChecked,true);assert.equal(result[0].price,120000);
 assert.equal(schemaCars(html({...offer,priceCurrency:'AED'}),source,{detailUrl:url})[0].price,null);
 assert.equal(schemaCars(html({...offer,availability:'https://schema.org/SoldOut'}),source,{detailUrl:url}).length,0);
 assert.equal(schemaCars(html({...offer,url:url.replace('12345','54321')}),source,{detailUrl:url}).length,0);
});
