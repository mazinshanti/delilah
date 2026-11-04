/**
 * InventoryIndex.search / searchTrustedOriginBody already return normalized,
 * deduplicated and strictly filtered records. Before any live/deep results
 * arrive, avoid passing the same hundreds of vehicles through the expensive
 * re-normalize/dedupe/rank cycle again.
 *
 * Once source records exist (or a cross-query live cache was merged), the
 * complete source-aware strict merge remains mandatory.
 */
export function initialOrMergedResults(job={},direct=[],full=[],strictMerge=()=>[]){
 const indexed=Array.isArray(job.indexedListings)?job.indexedListings:[];
 if(!Number(job.recentBufferReused)&&
    !(Array.isArray(direct)&&direct.length)&&
    !(Array.isArray(full)&&full.length))return indexed;
 return strictMerge(indexed,direct||[],full||[]);
}
