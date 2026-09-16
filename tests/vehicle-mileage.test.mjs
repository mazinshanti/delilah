import test from 'node:test';import assert from 'node:assert/strict';
import {extractMileage} from '../lib/vehicle-mileage.js';
test('Arabic and English mileage multipliers preserve actual magnitude',()=>{
 for(const [s,n] of [['الممشى 300 الف',300000],['العداد: ٣٠٠ ألف كم',300000],['Mileage: 150,000 km',150000],['100k km',100000],['0 km',0],['ممشى 250000',250000]])assert.equal(extractMileage(s),n,s);
});
test('price, years, ambiguous abbreviated mileage and ranges are not odometers',()=>{
 for(const s of ['2013 Toyota 19000 SAR','الممشى 300','190000 - 199999 km','New car'])assert.equal(extractMileage(s),null,s);
});
