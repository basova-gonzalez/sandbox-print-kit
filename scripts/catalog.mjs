import {json} from './core.mjs';

// Each supported size has its own measured template; no runtime scaling.
export function formatConfig(composition, format) {
  const entry=json('templates/catalog.json')[composition+'-'+format];
  if(!entry)throw Error('UNSUPPORTED_FORMAT: no integrated template for '+composition+' '+format);
  return entry;
}
