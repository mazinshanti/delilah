import crypto from 'node:crypto';
import {validateSellerInput} from './seller-validation.js';
const allowedSaudiRegions=new Set(['me-central2','me-riyadh-1','me-jeddah-1','saudi']);
let poolPromise=null,schemaPromise=null;
export function sellerStoreStatus(env=process.env){const configured=Boolean(env.SAUDI_DATABASE_URL),region=String(env.DALELAH_DATA_REGION||'').trim(),residency=String(env.DALELAH_DATA_RESIDENCY||'').toLowerCase(),saudi=allowedSaudiRegions.has(region)||residency==='saudi';return{configured,region:region||null,residency:residency||null,writable:configured&&saudi,reason:!configured?'saudi-database-not-configured':!saudi?'saudi-residency-not-confirmed':null};}
async function getPool(){const s=sellerStoreStatus();if(!s.writable)throw Error(s.reason);if(!poolPromise)poolPromise=import('pg').then(({Pool})=>new Pool({connectionString:process.env.SAUDI_DATABASE_URL,ssl:process.env.SAUDI_DATABASE_SSL==='false'?false:{rejectUnauthorized:true,...(process.env.SAUDI_DATABASE_CA?{ca:process.env.SAUDI_DATABASE_CA.replace(/\\n/g,'\n')}:{})},max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:10000,statement_timeout:12000}));return poolPromise;}
export const SELLER_SCHEMA=`
CREATE TABLE IF NOT EXISTS dalelah_seller_submissions (
 id UUID PRIMARY KEY,status TEXT NOT NULL DEFAULT 'pending',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 seller_name TEXT NOT NULL,seller_phone TEXT NOT NULL,seller_email TEXT,consent_version TEXT NOT NULL,consent_at TIMESTAMPTZ NOT NULL,
 vin TEXT,make TEXT NOT NULL,model TEXT NOT NULL,trim TEXT,model_year INTEGER NOT NULL,mileage_km INTEGER,city TEXT NOT NULL,asking_price_sar NUMERIC,description TEXT,
 valuation_median_sar NUMERIC,valuation_low_sar NUMERIC,valuation_high_sar NUMERIC,comparable_count INTEGER,public_token TEXT UNIQUE NOT NULL
);
ALTER TABLE dalelah_seller_submissions ADD COLUMN IF NOT EXISTS request_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS dalelah_seller_request_id ON dalelah_seller_submissions(request_id);
CREATE INDEX IF NOT EXISTS idx_dalelah_seller_status ON dalelah_seller_submissions(status,created_at DESC);
CREATE TABLE IF NOT EXISTS dalelah_seller_photos (
 id UUID PRIMARY KEY,submission_id UUID NOT NULL REFERENCES dalelah_seller_submissions(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position>=0 AND position<10),mime TEXT NOT NULL CHECK(mime='image/webp'),
 width INTEGER NOT NULL,height INTEGER NOT NULL,sha256 TEXT NOT NULL,data BYTEA NOT NULL,
 UNIQUE(submission_id,position),UNIQUE(submission_id,sha256)
);`;
export async function sellerStoreReady(){const pool=await getPool();if(!schemaPromise)schemaPromise=pool.query(SELLER_SCHEMA).catch(e=>{schemaPromise=null;throw e;});await schemaPromise;await pool.query('SELECT 1');return pool;}
// pool injection is for local integration testing with an actual PostgreSQL engine.
export async function createSellerSubmission(input={},options={}){
 const validation=validateSellerInput({...input,photos:[]});if(!validation.ok)throw Error('invalid-submission');
 const v=validation.value,pool=options.pool||await sellerStoreReady(),client=await pool.connect();
 try{await client.query('BEGIN');const id=crypto.randomUUID(),token=crypto.randomBytes(24).toString('base64url');
 const values=[id,v.sellerName,v.sellerPhone,v.sellerEmail||null,v.consentVersion,new Date().toISOString(),v.vin||null,v.make,v.model,v.trim||null,v.year,v.mileageKm,v.city,v.askingPriceSar,v.description||null,token,v.requestId||null];
 const result=await client.query(`INSERT INTO dalelah_seller_submissions(id,seller_name,seller_phone,seller_email,consent_version,consent_at,vin,make,model,trim,model_year,mileage_km,city,asking_price_sar,description,public_token,request_id) VALUES(${values.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT(request_id) DO NOTHING RETURNING id,status,created_at,public_token`,values);
 let row=result.rows[0];if(!row){const existing=await client.query('SELECT id,status,created_at,public_token FROM dalelah_seller_submissions WHERE request_id=$1',[v.requestId]);row=existing.rows[0];}else{
 let position=0;for(const p of input.photos||[]){if(!Buffer.isBuffer(p.data)||p.data.length>2000000||position>=10)throw Error('invalid-prepared-photo');await client.query('INSERT INTO dalelah_seller_photos(id,submission_id,position,mime,width,height,sha256,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[crypto.randomUUID(),id,position++,p.mime,p.width,p.height,p.hash,p.data]);}}
 const count=await client.query('SELECT COUNT(*)::int AS n FROM dalelah_seller_photos WHERE submission_id=$1',[row.id]);await client.query('COMMIT');return{...row,photo_count:count.rows[0].n};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function findSellerSubmission(reference){const pool=await sellerStoreReady();const {rows}=await pool.query('SELECT status,created_at,(SELECT COUNT(*)::int FROM dalelah_seller_photos p WHERE p.submission_id=s.id) AS photo_count FROM dalelah_seller_submissions s WHERE public_token=$1',[reference]);return rows[0]||null;}
export function validateSellerSubmission(input={}){return validateSellerInput(input);}
