import { createHash } from 'node:crypto';
import { normalizePayrollOverrideBundle, normalizePayrollSettings, payrollOverrideSignature } from './normalizers.js';

const COLLECTIONS = Object.freeze({
  settings: 'payrollSettings',
  overrides: 'payrollOverrides',
  audits: 'payrollWriteAudits'
});

export function payrollOverrideDocumentId(monthName) {
  return `po_${String(monthName || '').replace(/[^\w-]/g, '_')}`;
}

export function payrollWriteAuditDocumentId({ requestId, method, uid }) {
  const input = [String(uid || ''), String(method || ''), String(requestId || '')].join('\n');
  return `pwa_${createHash('sha256').update(input).digest('hex')}`;
}

function matchingAuditResult(snapshot, { method, identity }) {
  if (!snapshot.exists) return null;
  const audit = snapshot.data() || {};
  return audit.method === method && audit.actorUid === String(identity?.uid || '')
    ? audit.result || {}
    : null;
}

export function createPayrollStore(firestore) {
  if (!firestore) throw new TypeError('firestore is required.');

  const settingsRef = firestore.collection(COLLECTIONS.settings).doc('global');
  const overrideRef = monthName => firestore.collection(COLLECTIONS.overrides).doc(payrollOverrideDocumentId(monthName));
  const auditRef = ({ requestId, method, identity }) => firestore.collection(COLLECTIONS.audits)
    .doc(payrollWriteAuditDocumentId({ requestId, method, uid: identity?.uid }));
  const legacyAuditRef = requestId => firestore.collection(COLLECTIONS.audits).doc(String(requestId || '').replace(/[^\w:.-]/g, '_').slice(0, 200));

  return {
    async getFinalizations(monthName) {
      const snapshot=await firestore.collection('payrollFinalizations').doc(monthName).collection('versions').orderBy('createdAt','desc').limit(12).get();
      return snapshot.docs.map(d=>({id:d.id,...d.data()}));
    },
    async saveFinalization({requestId,monthName,identity,nowIso,snapshot}) {
      const id=payrollWriteAuditDocumentId({requestId,method:'savePayrollFinalization',uid:identity.uid});
      const target=firestore.collection('payrollFinalizations').doc(monthName).collection('versions').doc(id);
      return firestore.runTransaction(async transaction=>{
        const [existing,currentSettings,currentOverrides]=await transaction.getAll(target,settingsRef,overrideRef(monthName));
        if(existing.exists)return {success:true,id,duplicate:true};
        if(JSON.stringify(normalizePayrollSettings(currentSettings.data()?.settings||{}))!==JSON.stringify(snapshot.settings)||payrollOverrideSignature(currentOverrides.data()?.overrides||{})!==snapshot.overrideSignature)throw new Error('정산 조건이 변경되었습니다. 다시 조회해 주세요.');
        if(Buffer.byteLength(JSON.stringify(snapshot),'utf8')>900000)throw new Error('확정 자료가 큽니다. 강사를 선택하여 개별 확정해 주세요.');
        transaction.create(target,{...snapshot,monthName,createdAt:nowIso,actor:{uid:identity.uid||'',name:identity.name||''}});
        return {success:true,id,createdAt:nowIso};
      });
    },

    async getSettings() {
      const snapshot = await settingsRef.get();
      return normalizePayrollSettings(snapshot.exists ? snapshot.data()?.settings : {});
    },

    async getOverrides(monthName) {
      const snapshot = await overrideRef(monthName).get();
      return normalizePayrollOverrideBundle(snapshot.exists ? snapshot.data()?.overrides : {});
    },

    async saveSettings({ requestId, payload, identity, mutate, nowIso }) {
      return firestore.runTransaction(async transaction => {
        const method = 'savePayrollSettings';
        const audit = auditRef({ requestId, method, identity });
        const [auditSnapshot, legacyAuditSnapshot, settingsSnapshot] = await transaction.getAll(audit, legacyAuditRef(requestId), settingsRef);
        const previous = matchingAuditResult(auditSnapshot, { method, identity }) || matchingAuditResult(legacyAuditSnapshot, { method, identity });
        if (previous) return { ...previous, duplicate: true };
        const current = normalizePayrollSettings(settingsSnapshot.exists ? settingsSnapshot.data()?.settings : {});
        const settings = mutate(current);
        const result = { success: true, settings };
        transaction.set(settingsRef, { settings, updatedAt: nowIso, updatedBy: identity.uid || '', updatedByName: identity.name || '' });
        transaction.set(audit, { requestId, method, payload, actorUid: identity.uid || '', actorName: identity.name || '', createdAt: nowIso, result });
        return result;
      });
    },

    async saveOverrides({ requestId, monthName, overrides, identity, nowIso }) {
      return firestore.runTransaction(async transaction => {
        const method = 'savePayrollOverrides';
        const audit = auditRef({ requestId, method, identity });
        const target = overrideRef(monthName);
        const [auditSnapshot, legacyAuditSnapshot, targetSnapshot] = await transaction.getAll(audit, legacyAuditRef(requestId), target);
        const previous = matchingAuditResult(auditSnapshot, { method, identity }) || matchingAuditResult(legacyAuditSnapshot, { method, identity });
        if (previous) return { ...previous, duplicate: true };
        const current = normalizePayrollOverrideBundle(targetSnapshot.exists ? targetSnapshot.data()?.overrides : {});
        if ((targetSnapshot.exists && !overrides.expectedSignature) || (overrides.expectedSignature && overrides.expectedSignature !== payrollOverrideSignature(current))) {
          return {success:false, conflict:true, message:'다른 PC에서 정산 내역을 수정했습니다. 새로고침 후 다시 수정해 주세요.'};
        }
        const normalized = { ...normalizePayrollOverrideBundle(overrides), updatedAt: nowIso };
        const result = { success: true, monthName, overrides: normalized };
        transaction.set(target, { monthName, overrides: normalized, updatedAt: nowIso, updatedBy: identity.uid || '', updatedByName: identity.name || '' });
        transaction.set(audit, { requestId, method, monthName, actorUid: identity.uid || '', actorName: identity.name || '', createdAt: nowIso, result });
        return result;
      });
    }
  };
}
