import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSyarahCashPrice} from '../lib/syarah-price.js';

const cases=[
  ['Cash Price(Includes VAT)29,500SAR 36,500SAR Installment 647 SAR/month',29500,'syarah_cash_price_text'],
  ['Cash Price (Includes VAT) 114,900 SAR 133,500 SAR Installment 2,451 SAR/month',114900,'syarah_cash_price_text'],
  ['Cash Price\n29,500 SAR\n36,500 SAR\nInstallment 647 SAR/Monthly',29500,'syarah_cash_price_text'],
  ['سعر الكاش(شامل الضريبة)71,500ريال 74,500ريال',71500,'syarah_cash_price_text'],
  ['السعر النقدي ٨٣٬٧٠٠ ريال',83700,'syarah_cash_price_text'],
  ['2023 Kia Pegas LX used guaranteed, White color, priced at 29,500 SAR including VAT.',29500,'syarah_detail_description_price']
];
for(const [text,price,source] of cases){
  test(`Syarah cash price: ${text.slice(0,48)}`,()=>{
    const hit=extractSyarahCashPrice(text);
    assert.ok(hit);assert.equal(hit.price,price);assert.equal(hit.source,source);assert.equal(hit.confidence,'high');
  });
}
test('does not use installment as vehicle price',()=>assert.equal(extractSyarahCashPrice('Installment 2,451 SAR/month Used 47,262 KM'),null));
test('does not use discount or previous price without cash label',()=>assert.equal(extractSyarahCashPrice('Coupon 1,500 SAR OFF discount 18,600 SAR previous 133,500 SAR'),null));
test('does not use mileage as price',()=>assert.equal(extractSyarahCashPrice('Used 138,153 KM Inspected & Guaranteed'),null));
