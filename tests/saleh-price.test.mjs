import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSalehPrice} from '../lib/saleh-price.js';

test('Saleh visible price prefers first displayed amount and keeps VAT amount',()=>{
  const hit=extractSalehPrice('TOYOTA YARIS Y LIMITED 2026 57,900 SAR 66,585 SAR (After VAT)','');
  assert.equal(hit.price,57900);
  assert.equal(hit.vatPrice,66585);
  assert.equal(hit.source,'saleh_visible_price');
});

test('Saleh escaped Next.js gtmProps extracts primary listing price',()=>{
  const html='self.__next_f.push([1,"gtmProps\\\\\\\":{\\\\\\\"value\\\\\\\":60900,\\\\\\\"id\\\\\\\":\\\\\\\"69a971ec6c4a6fc01fc27229\\\\\\\",\\\\\\\"price\\\\\\\":70035,\\\\\\\"discount\\\\\\\":0}"])';
  const hit=extractSalehPrice('',html);
  assert.equal(hit.price,60900);
  assert.equal(hit.vatPrice,70035);
  assert.equal(hit.source,'saleh_gtm_listing_value');
});

test('Saleh escaped Next.js Y Limited value stays pre-VAT price',()=>{
  const html='gtmProps\\\":{\\\"value\\\":57900,\\\"price\\\":66585,\\\"discount\\\":0}';
  const hit=extractSalehPrice('',html);
  assert.equal(hit.price,57900);
  assert.equal(hit.vatPrice,66585);
});

test('Saleh parser ignores installment-like unlabeled numbers',()=>{
  assert.equal(extractSalehPrice('Monthly installment 799 SAR',''),null);
});
