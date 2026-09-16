import {VEHICLE_CATALOG} from './catalog.js';
export const BRANDS=VEHICLE_CATALOG.makes.map(m=>[m.name,m.name.slice(0,2)]);
export const MODELS=Object.fromEntries(VEHICLE_CATALOG.makes.map(m=>[m.name,m.models.map(x=>x.name)]));
