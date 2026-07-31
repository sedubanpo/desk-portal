export function createDeskStore(database) {
  if (!database) throw new TypeError('legacy realtime database is required.');
  const ref = path => {
    const normalized = String(path || '').replace(/^\/+|\/+$/g, '');
    return normalized ? database.ref(normalized) : database.ref();
  };
  return {
    async get(path) {
      const snapshot = await ref(path).get();
      return snapshot.exists() ? snapshot.val() : null;
    },
    async set(path, value) {
      await ref(path).set(value);
      return value;
    },
    async update(path, value) {
      await ref(path).update(value);
      return value;
    },
    async remove(path) {
      await ref(path).remove();
    },
    async transaction(path, update) {
      const result = await ref(path).transaction(update, undefined, false);
      return result.snapshot.val();
    }
  };
}
