import { normalizePayrollOverrideBundle, normalizePayrollSettings } from './normalizers.js';

const COLLECTIONS = Object.freeze({
  settings: 'payrollSettings',
  overrides: 'payrollOverrides',
  audits: 'payrollWriteAudits'
});

export function payrollOverrideDocumentId(monthName) {
  return `po_${String(monthName || '').replace(/[^\w-]/g, '_')}`;
}

export function createPayrollStore(firestore) {
  if (!firestore) throw new TypeError('firestore is required.');

  const settingsRef = firestore.collection(COLLECTIONS.settings).doc('global');
  const overrideRef = monthName => firestore.collection(COLLECTIONS.overrides).doc(payrollOverrideDocumentId(monthName));
  const auditRef = requestId => firestore.collection(COLLECTIONS.audits).doc(String(requestId || '').replace(/[^\w:.-]/g, '_').slice(0, 200));

  return {
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
        const audit = auditRef(requestId);
        const [auditSnapshot, settingsSnapshot] = await transaction.getAll(audit, settingsRef);
        if (auditSnapshot.exists) return { ...(auditSnapshot.data()?.result || {}), duplicate: true };
        const current = normalizePayrollSettings(settingsSnapshot.exists ? settingsSnapshot.data()?.settings : {});
        const settings = mutate(current);
        const result = { success: true, settings };
        transaction.set(settingsRef, { settings, updatedAt: nowIso, updatedBy: identity.uid || '', updatedByName: identity.name || '' });
        transaction.set(audit, { requestId, method: 'savePayrollSettings', payload, actorUid: identity.uid || '', actorName: identity.name || '', createdAt: nowIso, result });
        return result;
      });
    },

    async saveOverrides({ requestId, monthName, overrides, identity, nowIso }) {
      return firestore.runTransaction(async transaction => {
        const audit = auditRef(requestId);
        const target = overrideRef(monthName);
        const auditSnapshot = await transaction.get(audit);
        if (auditSnapshot.exists) return { ...(auditSnapshot.data()?.result || {}), duplicate: true };
        const normalized = { ...normalizePayrollOverrideBundle(overrides), updatedAt: nowIso };
        const result = { success: true, monthName, overrides: normalized };
        transaction.set(target, { monthName, overrides: normalized, updatedAt: nowIso, updatedBy: identity.uid || '', updatedByName: identity.name || '' });
        transaction.set(audit, { requestId, method: 'savePayrollOverrides', monthName, actorUid: identity.uid || '', actorName: identity.name || '', createdAt: nowIso, result });
        return result;
      });
    }
  };
}
