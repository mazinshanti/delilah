import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInventoryListing } from '../lib/inventory-normalizer.js';

test('normalizes Arabic-Indic numbers in price, mileage, and year', () => {
  const car = normalizeInventoryListing({
    source: 'Sample Feed',
    listingId: 'arabic-numerals-1',
    make: 'Toyota',
    model: 'Camry',
    title: 'تويوتا كامري ٢٠٢٢',
    year: '٢٠٢٢',
    price: '٨٩٬٥٠٠ ريال',
    mileage: '٥٤٬٠٠٠ كم',
  });
  assert.equal(car.year, 2022);
  assert.equal(car.priceSar, 89500);
  assert.equal(car.mileageKm, 54000);
});

test('normalizes Persian numerals and Arabic decimal separators', () => {
  const car = normalizeInventoryListing({
    source: 'Sample Feed',
    listingId: 'persian-numerals-1',
    make: 'Toyota',
    model: 'Camry',
    year: '۲۰۲۱',
    price: '۷۵٬۵۰۰٫۵',
    mileage: '۴۰٬۰۰۰',
  });
  assert.equal(car.year, 2021);
  assert.equal(car.priceSar, 75500.5);
  assert.equal(car.mileageKm, 40000);
});

test('retains Western numerals and comma thousands separators', () => {
  const car = normalizeInventoryListing({
    source: 'Sample Feed',
    listingId: 'western-numerals-1',
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    price: '89,500 SAR',
    mileage: '54,000 km',
  });
  assert.equal(car.priceSar, 89500);
  assert.equal(car.mileageKm, 54000);
});
