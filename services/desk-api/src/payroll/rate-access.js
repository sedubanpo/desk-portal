import {createHash} from 'node:crypto';

// Firebase UIDs of the two designated payroll rate managers. Display names and roles are not identifiers.
const managers = new Set(['fe4d6cf07ac55132e4496d708c7f232add581396353685e4119adb7f2a296ab2', '131432b297c3e5ba14bd8dd139a7d760ada9cb287dc788020bf449cf25ec8bd3']);
export function managesPayrollRates(uid) {
  return managers.has(createHash('sha256').update(String(uid || '')).digest('hex'));
}
