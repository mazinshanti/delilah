import assert from 'node:assert/strict';
import { exactYear, yearBounds, queryTerms, identityMatches } from '../lib/search-semantics-v26.js';

assert.equal(exactYear('Corolla 2013'), 2013);
assert.equal(exactYear('كورولا ٢٠١٣'), 2013);
assert.deepEqual(yearBounds('Corolla 2013'), { minYear: 2013, maxYear: 2013, exactYear: 2013 });
assert.deepEqual(yearBounds('Corolla 2013 and above'), { minYear: 2013, maxYear: null, exactYear: null });
assert.deepEqual(yearBounds('Corolla 2013 or older'), { minYear: null, maxYear: 2013, exactYear: null });
assert.deepEqual(yearBounds('Corolla 2012 to 2015'), { minYear: 2012, maxYear: 2015, exactYear: null });
assert.deepEqual(yearBounds('كورولا 2013 وفوق'), { minYear: 2013, maxYear: null, exactYear: null });
assert.deepEqual(queryTerms('Patrol under 170k in Riyadh'), ['patrol']);
assert.deepEqual(queryTerms('Toyota Corolla 2013'), ['toyota', 'corolla']);
assert.deepEqual(queryTerms('تويوتا كورولا ٢٠١٣ بالرياض'), ['toyota', 'corolla']);
assert.equal(identityMatches({ brand:'Toyota', model:'Corolla', title:'Toyota Corolla 2013 XLI' }, 'تويوتا كورولا 2013'), true);
assert.equal(identityMatches({ brand:'Toyota', model:'Camry', title:'Toyota Camry 2013' }, 'Corolla 2013'), false);

console.log('PASS market coverage v26 semantics');
