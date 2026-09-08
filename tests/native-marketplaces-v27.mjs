import assert from 'node:assert/strict';
import {
  harajInfo, harajLinks, yallaInfo, yallaLinks, motoryInfo, motoryLinks,
  syarahInfo, syarahLinks, mileageFrom, priceFrom, looksLikeVehicle
} from '../lib/native-marketplaces-v27.js';

assert.deepEqual(harajInfo('https://haraj.com.sa/11177785557/كورولا_2013/'), {id:'11177785557'});
assert.equal(harajInfo('https://haraj.com.sa/search/تويوتا%20كورولا%202013/'), null);
assert.deepEqual(harajLinks('<a href="/11177785557/كورولا_2013/">car</a><a href="/search/x">search</a>', 'https://haraj.com.sa/'), ['https://haraj.com.sa/11177785557/%D9%83%D9%88%D8%B1%D9%88%D9%84%D8%A7_2013']);

assert.deepEqual(yallaInfo('https://ksa.yallamotor.com/used-cars/toyota/corolla/2013/used-toyota-corolla-2013-riyadh-2109624'), {brandSlug:'toyota',modelSlug:'corolla',year:2013,condition:'used'});
assert.equal(yallaInfo('https://ksa.yallamotor.com/used-cars/toyota/corolla/yr_2013_2013'), null);
assert.equal(yallaLinks('<a href="/used-cars/toyota/corolla/2013/used-toyota-corolla-2013-riyadh-2109624">x</a>', 'https://ksa.yallamotor.com/', 2013).length, 1);

assert.deepEqual(motoryInfo('https://ksa.motory.com/en/cars-for-sale/riyadh-haraj/toyota/corolla/2013/275354/'), {citySlug:'riyadh',brandSlug:'toyota',modelSlug:'corolla',year:2013,id:'275354'});
assert.equal(motoryLinks('<a href="/en/cars-for-sale/jeddah-haraj/toyota/corolla/2013/260340/">x</a>', 'https://ksa.motory.com/', 2013).length, 1);

assert.deepEqual(syarahInfo('https://syarah.com/en/cardetail/toyota-corolla-used-294733'), {slug:'toyota-corolla',condition:'used',id:'294733'});
assert.deepEqual(syarahInfo('https://syarah.com/en/cardetail/toyota-corolla-new-269756'), {slug:'toyota-corolla',condition:'new',id:'269756'});
assert.equal(syarahLinks('<a href="/en/cardetail/toyota-corolla-used-294733">x</a>', 'https://syarah.com/en/autos/toyota/corolla/2025').length, 1);

assert.equal(mileageFrom('الممشى: 238 ألف كيلو'), 238000);
assert.equal(mileageFrom('Mileage 186,000 KM'), 186000);
assert.equal(priceFrom('Cash Price 82,500 SAR'), 82500);
assert.equal(priceFrom('السعر: 31 ألف ريال'), 31000);
assert.equal(looksLikeVehicle('كورولا 2013', 'سيارة نظيفة للبيع'), true);
assert.equal(looksLikeVehicle('قطع داخلية كورولا 2013', 'للبيع'), false);

console.log('PASS native Saudi marketplace adapters v27');
