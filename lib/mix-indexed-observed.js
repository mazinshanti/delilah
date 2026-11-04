import {mergeDirectListings} from './direct-search.js';

/**
 * The common case has no reusable matching live URL. Avoid repeating the
 * expensive image/gallery merge over hundreds of already ranked index rows.
 */
export function mixIndexedAndObserved(historical=[],recentlyObserved=[]){
 return recentlyObserved.length?mergeDirectListings(historical,recentlyObserved):historical;
}
