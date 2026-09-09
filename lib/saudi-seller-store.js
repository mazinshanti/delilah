import crypto from 'node:crypto';

const allowedSaudiRegions = new Set(['me-central2','me-riyadh-1','me-jeddah-1','saudi']);
let poolPromise = null;
let schemaPromise = null;

export function sellerStoreStatus(env = process.env) {
  const configured = Boolean(env.SAUDI_DATABASE_URL);
  const region = String(env.DALELAH_DATA_REGION || '').trim();
  const residency = String(env.DALELAH_DATA_RESIDENCY || '').trim().toLowerCase();
  const saudiRegion = allowedSaudiRegions.has(region) || residency === 'saudi';
  return {
    configured,
    region: region || null,
    residency: residency || null,
    writable: configured && saudiRegion,
    reason: !configured ? 'saudi-database-not-configured' : !saudiRegion ? 'saudi-residency-not-confirmed' : null
  };
}

async function getPool() {
  const status = sellerStoreStatus();
  if (!status.writable) throw new Error(status.reason || 'seller-store-unavailable');
  if (!poolPromise) {
    poolPromise = import('pg').then(({Pool}) => new Pool({
      connectionString: process.env.SAUDI_DATABASE_URL,
      ssl: String(process.env.SAUDI_DATABASE_SSL || 'true').toLowerCase() === 'false' ? false : { rejectUnauthorized: false },
      max: Number(process.env.SAUDI_DATABASE_POOL_MAX || 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000
    }));
  }
  return poolPromise;
}

async function ensureSchema() {
  if (!schemaPromise) schemaPromise = (async () => {
    const pool = await getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dalelah_seller_submissions (
        id UUID PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        seller_name TEXT NOT NULL,
        seller_phone TEXT NOT NULL,
        seller_email TEXT,
        consent_version TEXT NOT NULL,
        consent_at TIMESTAMPTZ NOT NULL,
        vin TEXT,
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        trim TEXT,
        model_year INTEGER NOT NULL,
        mileage_km INTEGER,
        city TEXT NOT NULL,
        asking_price_sar NUMERIC,
        description TEXT,
        valuation_median_sar NUMERIC,
        valuation_low_sar NUMERIC,
        valuation_high_sar NUMERIC,
        comparable_count INTEGER,
        public_token TEXT UNIQUE NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_dalelah_seller_make_model_year
        ON dalelah_seller_submissions (make, model, model_year);
      CREATE INDEX IF NOT EXISTS idx_dalelah_seller_status
        ON dalelah_seller_submissions (status, created_at DESC);
    `);
  })();
  return schemaPromise;
}

const clean = value => String(value ?? '').replace(/\s+/g,' ').trim();
const nullable = value => clean(value) || null;
const numberOrNull = value => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(String(value).replace(/[^0-9.-]/g,''));
  return Number.isFinite(n) ? n : null;
};

export async function createSellerSubmission(input = {}) {
  await ensureSchema();
  const pool = await getPool();
  const id = crypto.randomUUID();
  const publicToken = crypto.randomBytes(12).toString('base64url');
  const consentAt = new Date().toISOString();
  const values = [
    id,
    clean(input.sellerName),
    clean(input.sellerPhone),
    nullable(input.sellerEmail),
    clean(input.consentVersion || 'dalelah-sell-v1'),
    consentAt,
    nullable(input.vin),
    clean(input.make),
    clean(input.model),
    nullable(input.trim),
    numberOrNull(input.year),
    numberOrNull(input.mileageKm),
    clean(input.city),
    numberOrNull(input.askingPriceSar),
    nullable(input.description),
    numberOrNull(input.valuation?.marketMedianPriceSar),
    numberOrNull(input.valuation?.suggestedLowSar),
    numberOrNull(input.valuation?.suggestedHighSar),
    numberOrNull(input.valuation?.comparableCount),
    publicToken
  ];
  const sql = `INSERT INTO dalelah_seller_submissions (
    id,seller_name,seller_phone,seller_email,consent_version,consent_at,vin,make,model,trim,model_year,mileage_km,city,asking_price_sar,description,valuation_median_sar,valuation_low_sar,valuation_high_sar,comparable_count,public_token
  ) VALUES (${values.map((_,i)=>`$${i+1}`).join(',')}) RETURNING id,status,created_at,public_token`;
  const {rows} = await pool.query(sql, values);
  return rows[0];
}

export function validateSellerSubmission(input = {}) {
  const errors = [];
  const year = numberOrNull(input.year);
  if (!clean(input.sellerName)) errors.push('sellerName');
  if (!/^\+?966\d{9}$|^05\d{8}$/.test(clean(input.sellerPhone).replace(/[\s-]/g,''))) errors.push('sellerPhone');
  if (!clean(input.make)) errors.push('make');
  if (!clean(input.model)) errors.push('model');
  if (!year || year < 1980 || year > new Date().getFullYear() + 1) errors.push('year');
  if (!clean(input.city)) errors.push('city');
  if (input.consent !== true) errors.push('consent');
  return {ok: errors.length === 0, errors};
}
