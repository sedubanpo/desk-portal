export function createDeskStore(database) {
  if (!database) throw new TypeError('legacy realtime database is required.');
  return {
    async get(path) {
      const snapshot = await database.ref(path).get();
      return snapshot.exists() ? snapshot.val() : null;
    },
    async set(path, value) {
      await database.ref(path).set(value);
      return value;
    },
    async update(path, value) {
      await database.ref(path).update(value);
      return value;
    },
    async remove(path) {
      await database.ref(path).remove();
    },
    async transaction(path, update) {
      const result = await database.ref(path).transaction(update, undefined, false);
      return result.snapshot.val();
    }
  };
}
