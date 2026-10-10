// Short-lived source snapshots only. Settings, overrides and authorization are never cached.
export function createReadCache({ ttlMs, maxEntries, clock = Date.now }) {
  const entries = new Map();
  return {
    async read(key, load, { forceRefresh = false } = {}) {
      const existing = entries.get(key);
      if (!forceRefresh && existing && (existing.pending || clock() - existing.loadedAt < ttlMs)) {
        const value = existing.pending ? await existing.pending : existing.value;
        return { value: structuredClone(value), hit: true, ageMs: Math.max(0, clock() - existing.loadedAt) };
      }
      const entry = { loadedAt: 0 };
      entries.delete(key);
      entries.set(key, entry);
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
      entry.pending = Promise.resolve().then(load).then(value => {
        entry.value = value;
        entry.loadedAt = clock();
        entry.pending = null;
        return value;
      }).catch(error => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
      const value = await entry.pending;
      return { value: structuredClone(value), hit: false, ageMs: 0 };
    }
  };
}
