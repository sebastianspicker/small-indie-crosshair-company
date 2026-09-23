/**
 * Bounded worker request sizes.
 *
 * The worker receives already-deserialized messages, so it cannot read the raw byte count.
 * These helpers bound the effective payload before any decode work runs, matching the
 * evidence-input cap in docs/engineering/quant-architecture.md. They live in `lib/` so they
 * can be unit-tested without a browser or a live worker.
 */
export const MAX_WORKER_PAYLOAD_BYTES = 1024 * 1024;

export function assertPayloadSize(bytes, limit = MAX_WORKER_PAYLOAD_BYTES) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0)
    throw new TypeError('Worker payload size must be a nonnegative finite number.');
  if (bytes > limit) throw new Error(`Worker payload exceeds the ${limit}-byte limit.`);
  return bytes;
}

/** Cheap recursive estimate that early-exits once it is over `limit`. Typed arrays are exact. */
export function estimatePayloadBytes(value, limit = MAX_WORKER_PAYLOAD_BYTES) {
  const walk = (node, budget) => {
    if (budget > limit) return budget;
    if (node == null) return budget + 8;
    if (typeof node === 'string') return budget + node.length * 2 + 8;
    if (typeof node !== 'object') return budget + 8;
    if (ArrayBuffer.isView(node) || node instanceof ArrayBuffer) return budget + node.byteLength + 8;
    let total = budget + 8;
    if (Array.isArray(node)) {
      for (const item of node) { total = walk(item, total); if (total > limit) return total; }
      return total;
    }
    for (const [key, item] of Object.entries(node)) {
      total = walk(item, total + key.length * 2);
      if (total > limit) return total;
    }
    return total;
  };
  return walk(value, 0);
}
