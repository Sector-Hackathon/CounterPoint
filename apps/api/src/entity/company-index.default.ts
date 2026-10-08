import { CompanyIndex } from './company-index';
import { COMPANY_ALIASES } from './company-aliases';
import { COMPANY_RECORDS } from './company-index.data';

let index: CompanyIndex | null = null;

/** The committed index (scripts/build-company-index.ts) plus the hand-written aliases, built once. */
export function defaultCompanyIndex(): CompanyIndex {
  index ??= new CompanyIndex(COMPANY_RECORDS, COMPANY_ALIASES);
  return index;
}
