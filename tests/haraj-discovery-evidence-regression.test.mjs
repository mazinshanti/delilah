import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCondition} from '../lib/vehicle-condition.js';
import {harajDetailRecord} from '../lib/haraj-inventory-collector.js';
const url='https://haraj.com.sa/12345678901/';
const html=(name,description)=>`<script type="application/ld+json">${JSON.stringify({'@type':'Car',url,name,description})}</script>`;
test('explicit Arabic condition field accepts new without treating dealer/year as evidence',()=>{
 assert.equal(resolveCondition({source:'Haraj',description:'موديل السيارة: 2026\nحالة السيارة: جديدة\nمحرك 2000 سي سي'}),'new');
 for(const description of ['حالة السيارة: ليست جديدة','حالة السيارة: كالجديدة','كفرات جديدة','معرض سيارات موديل 2026'])assert.equal(resolveCondition({source:'Haraj',description}),'unknown');
 assert.equal(resolveCondition({source:'Haraj',description:'حالة السيارة: جديدة',mileage:50000}),'used');
});
test('engine capacity cannot conflict with a real year, but conflicting years remain rejected',()=>{
 const r=harajDetailRecord({url},html('تويوتا كورولا مكينة 2000 بنزين 2026','سيارة جديدة للبيع'));
 assert.equal(r?.year,2026);
 assert.equal(harajDetailRecord({url},html('تويوتا كورولا 2020 2026','سيارة جديدة للبيع')),null);
 assert.equal(harajDetailRecord({url},html('تويوتا كورولا مكينة 2000','سيارة جديدة للبيع')),null);
});

test('dealer opening hours do not become watch ads, while watch ads stay quarantined',()=>{
 const title='تويوتا كورولا 2026';
 const description='حالة السيارة: جديدة\nللبيع السعر 80000 ريال\nالفترة الأولى من الساعة 9:00 صباحا حتى 12:00 ظهرا';
 assert.ok(harajDetailRecord({url},html(title,description)));
 assert.equal(harajDetailRecord({url},html(title,description+'\nساعة للبيع')),null);
});
