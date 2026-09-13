export function createTuitionStore(firestore) {
  if (!firestore) throw new TypeError('firestore is required.');

  const reference = key => {
    const [collection, ...idParts] = String(key || '').split('/');
    const id = idParts.join('/');
    if (!collection || !id || id.includes('/')) throw new TypeError(`invalid Firestore document key: ${key}`);
    return firestore.collection(collection).doc(id);
  };

  return {
    async get(key) {
      const snapshot = await reference(key).get();
      return snapshot.exists ? snapshot.data() : null;
    },
    async list(collection, limit = 1000) {
      const snapshot = await firestore.collection(collection).limit(limit).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    async listWhere(collection, field, operator, value, limit = 1000) {
      const snapshot = await firestore.collection(collection).where(field, operator, value).limit(limit).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    async transaction(keys, mutate, queries = []) {
      const uniqueKeys = [...new Set(keys.filter(Boolean))];
      return firestore.runTransaction(async transaction => {
        const refs = uniqueKeys.map(reference);
        const snapshots = refs.length ? await transaction.getAll(...refs) : [];
        const documents = Object.fromEntries(uniqueKeys.map((key, index) => [key, snapshots[index].exists ? snapshots[index].data() : null]));
        for (const query of queries) {
          const result = await transaction.get(firestore.collection(query.collection).where(query.field, '==', query.value).limit(5001));
          if (result.size > 5000) throw new Error('중복 검사 범위를 초과했습니다. 관리자에게 문의해 주세요.');
          documents[query.key] = result.docs.map(doc => doc.data());
        }
        const change = await mutate(documents);
        if (!change) return null;
        Object.entries(change.writes || {}).forEach(([key, value]) => transaction.set(reference(key), value));
        (change.deletes || []).forEach(key => transaction.delete(reference(key)));
        return change.result;
      });
    }
  };
}
