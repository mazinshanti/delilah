import test from 'node:test';
import assert from 'node:assert/strict';
import {needsAI} from '../public/search-route.js';

const semantic=[
 'ابي جيب عائلي ياباني تحت 150 ألف وصيانته رخيصة',
 'ابي جيب عائلي ياباني تحت ١٥٠ ألف وصيانته رخيصة',
 'ابغى سيارة عائلية اقتصادية ومريحة','أبي شي شبابي وقوي وصيانته مو غالية',
 'أدور سيارة فخمة لكن ما تكلفني بالصيانة','ابي SUV ياباني للعيال والسفر',
 'سيارة ألمانية رياضية بس تكون مريحة','ابغى سيارة عائلية اقتصادية',
 'أبي سيارة فخمة وصيانتها مو غالية','شي رياضي ومريح','ابي جيب للعائلة',
 'ابي كامري أو شيء مشابه لها بس أوسع للعائلة وصيانته رخيصة',
 'something like a Range Rover but cheaper to maintain','best family SUV under 120k',
 'luxury car with cheap maintenance','used German SUV but no Chinese cars',
 'something sporty but comfortable','reliable family car for long trips',
 'أَحْتَاج سيارة واسعة','وش تنصح','شيء مريح','وش الأفضل','للمشاوير وصرفيتها قليلة',
 'سيارة قطعها رخيصة','ما تكلفني بالصيانة','مناسبة للعائلة','سيارة اعتمادية',
 'سيارة كورية','سيارة أمريكية','سيارة غير صيني','سيارة بنزينها قليل',
 'شي مريح وعملي','أدور سيارة','احتاج سيارة','Toyota كامري فخمة',
 'سيارة فخمة','value for money car','comfortable car','family travel car'
];
const simple=['Camry 2022','Toyota Corolla 2013','BMW X5 2021','كامري ٢٠٢٢',
 'باترول 2020 الرياض','used Lexus RX 2022','new Hyundai Tucson','كامري 2022 الرياض',
 'Toyota Camry 2022 Riyadh under 100k','Toyota Camry 2022 Riyadh','باترول 2020',
 'جيب رانجلر 2022','كامري 2022','Camry 2022 الرياض','تويوتا Camry ٢٠٢٢',
 'ميتسوبيشي باجيرو 2020','Bentley','جي كلاس','G Class','__all_cars__','',
 'كامري 2022 تحت 100 ألف','كامري ٢٠٢٢ تحت ١٠٠ ألف'];
for(const q of semantic)test(`semantic classifier: ${q}`,()=>assert.equal(needsAI(q),true));
for(const q of simple)test(`deterministic classifier: ${q}`,()=>assert.equal(needsAI(q),false));
