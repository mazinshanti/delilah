/**
 * A deep-scan response is not proof that live discovery finished.
 * Keep the browser's search session open until both lanes finish or the
 * bounded deadline expires; otherwise new source results get silently lost.
 */
export function searchCompletionState(job={},now=Date.now()){
 const full=job.fullData||{};
 const fullComplete=Boolean(job.fullData&&(full.complete===true||full.marketScanComplete===true));
 const liveDiscoveryPending=job.directDone!==true;
 const pricePending=Boolean(job.priceEnrichmentPromise&&!job.priceEnrichmentComplete);
 const syarahPricePending=Boolean(job.syarahPriceEnrichmentPromise&&!job.syarahPriceEnrichmentComplete);
 const deepUnavailable=Boolean(job.error&&job.fullDone);
 const allFinished=job.directDone===true&&(fullComplete||deepUnavailable)&&!pricePending&&!syarahPricePending;
 const scanTimedOut=!allFinished&&Number.isFinite(job.createdAt)&&now-job.createdAt>90_000;
 return {fullComplete,liveDiscoveryPending,pricePending,syarahPricePending,
  scanTimedOut,complete:allFinished||scanTimedOut};
}
