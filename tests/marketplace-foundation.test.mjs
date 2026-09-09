import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInventoryListing, normalizeInventoryBatch } from '../lib/inventory-normalizer.js';
import { scoreDeal } from '../lib/deal-score.js';

test('normalizes a marketplace listing while preserving Dalelah 1.5 compatibility fields', () => {
  const car = normalizeInventoryListing({
    source: 'Example Dealer',
    sourceType: 'dealer-feed',
    listingId: 'ABC123',
    url: 'https://example.com/cars/abc123?utm_source=test',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    condition: 'used',
    price: '89,500 SAR',
    mileage: '54,000 km',
    city: 'Riyadh',
    sellerName: 'Example Motors',
    sellerVerified: true,
    inspectionStatus: 'passed',
    historyStatus: 'verified',
    warrantyMonths: 12,
    images: ['https://example.com/a.jpg']
  });

  assert.equal(car.price, 89500);
  assert.equal(car.mileageKm, 54000);
  assert.equal(car.vehicle.make, 'Toyota');
  assert.equal(car.sellerDetails.name, 'Example Motors');
  assert.equal(car.trust.level, 'certified');
  assert.equal(car.url, 'https://example.com/cars/abc123');
});

test('deduplicates primarily by VIN when feeds overlap', () => {
  const cars = normalizeInventoryBatch([
    { source: 'Feed A', vin: 'VIN123', url: 'https://a.example/1', make: 'Toyota', model: 'Camry', year: 2022 },
    { source: 'Feed B', vin: 'VIN123', url: 'https://b.example/2', make: 'Toyota', model: 'Camry', year: 2022 }
  ]);
  assert.equal(cars.length, 1);
  assert.equal(cars[0].vehicle.vin, 'VIN123');
});

test('deal score refuses to pretend when there are too few comparables', () => {
  const deal = scoreDeal({ priceSar: 90000, marketMedianPriceSar: 100000, comparableCount: 2 });
  assert.equal(deal.available, false);
  assert.equal(deal.reason, 'insufficient-comparables');
});

test('deal score identifies a materially below-market car', () => {
  const deal = scoreDeal({ priceSar: 85000, marketMedianPriceSar: 100000, comparableCount: 20 });
  assert.equal(deal.available, true);
  assert.equal(deal.grade, 'great');
  assert.equal(deal.priceDeltaPct, -15);
});
