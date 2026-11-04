const MAX_CACHE_MS=5000;
const MAX_CACHED_ROWS=750;

/**
 * Search progress may be polled every 1.5 seconds, often while no new source
 * results have arrived. Re-running normalization, dedup and ranking in that
 * case can saturate the small Render frontend.
 *
 * Cache an already computed public response for at most five seconds, and
 * immediately invalidate on changes to any source, price enrichment or
 * completion state. Never reuse a stale "scanning" response after deadline.
 * Keep responses with huge listing arrays out of memory cache.
 */
export function memoizedSearchResponse(job,calculate,now=Date.now()){
 const keys=[
  job.directData,job.directData?.listings,job.directDone,
  job.fullData,job.fullData?.listings,job.fullDone,job.error,
  job.firstResultMs,job.deepZeroRetry,job.upstreamId,
  job.priceEnrichmentPromise,job.priceEnrichmentComplete,job.priceEnriched,
  job.priceAttempted,job.priceEnrichmentError,
  job.syarahPriceEnrichmentPromise,job.syarahPriceEnrichmentComplete,
  job.syarahPriceEnriched,job.syarahPriceAttempted,
  job.syarahPriceEnrichmentError,job.progressError,
  job.intentResult
 ];
 const cached=job.publicResponseMemo;
 if(cached&&now-cached.at<MAX_CACHE_MS&&cached.keys.length===keys.length&&
  keys.every((v,i)=>Object.is(v,cached.keys[i]))&&
  !(now-job.createdAt>90_000&&cached.response?.complete!==true)){
  return cached.response;
 }
 const response=calculate();
 if(Array.isArray(response?.listings)&&response.listings.length<=MAX_CACHED_ROWS)
  job.publicResponseMemo={at:now,keys,response};
 else delete job.publicResponseMemo;
 return response;
}

export function expirePublicResponseMemo(job,now=Date.now()){
 if(job.publicResponseMemo&&now-job.publicResponseMemo.at>=MAX_CACHE_MS)
  delete job.publicResponseMemo;
}
