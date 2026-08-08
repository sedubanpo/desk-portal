const DEFAULT_READ_TIMEOUT_MS = 8000;

function readTimeoutError(path) {
  const error = new Error(`Realtime Database read timed out: ${path || '/'}`);
  error.code = 'rtdb_read_timeout';
  return error;
}

function withReadTimeout(promise, path, timeoutMs) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(readTimeoutError(path)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

export function createDeskStore(database, { readTimeoutMs = DEFAULT_READ_TIMEOUT_MS } = {}) {
  if (!database) throw new TypeError('legacy realtime database is required.');
  let reconnectPromise = null;
  const ref = path => {
    const normalized = String(path || '').replace(/^\/+|\/+$/g, '');
    return normalized ? database.ref(normalized) : database.ref();
  };

  async function reconnect() {
    if (reconnectPromise) return reconnectPromise;
    reconnectPromise = Promise.resolve().then(() => {
      if (typeof database.goOffline === 'function') database.goOffline();
      if (typeof database.goOnline === 'function') database.goOnline();
    }).finally(() => {
      reconnectPromise = null;
    });
    return reconnectPromise;
  }

  return {
    async get(path) {
      let snapshot;
      try {
        snapshot = await withReadTimeout(ref(path).get(), path, readTimeoutMs);
      } catch (error) {
        if (error?.code !== 'rtdb_read_timeout') throw error;
        await reconnect();
        snapshot = await withReadTimeout(ref(path).get(), path, readTimeoutMs);
      }
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
