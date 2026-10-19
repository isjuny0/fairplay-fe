const reads = new Map();

export function invalidateSharedReads() {
  reads.clear();
}

export function invalidateSharedRead(key) {
  reads.delete(key);
}

// Cache display data briefly; permission-bearing reads only share an in-flight request.
export function sharedRead(key, load, maxAge = 0) {
  const now = Date.now();
  for (const [cachedKey, entry] of reads) {
    if (entry.expiresAt <= now) reads.delete(cachedKey);
  }
  const cached = reads.get(key);
  if (cached) return cached.promise;

  const entry = { expiresAt: Infinity };
  entry.promise = Promise.resolve()
    .then(load)
    .then(
      (result) => {
        if (reads.get(key) === entry) {
          if (maxAge > 0) entry.expiresAt = Date.now() + maxAge;
          else reads.delete(key);
        }
        return result;
      },
      (error) => {
        if (reads.get(key) === entry) reads.delete(key);
        throw error;
      },
    );
  reads.set(key, entry);
  return entry.promise;
}
