// Limitador de intentos en memoria (ventana deslizante simple). Suficiente
// para un solo proceso; en despliegues con varias instancias usar Redis o BD.

interface Bucket {
  count: number;
  resetAt: number;
}

declare global {
  var __bh7RateLimits: Map<string, Bucket> | undefined;
}

const buckets: Map<string, Bucket> =
  globalThis.__bh7RateLimits ?? (globalThis.__bh7RateLimits = new Map());

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function hitRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Consulta si la clave está bloqueada, sin sumar un intento. */
export function checkRateLimit(key: string, limit: number): RateLimitResult {
  const bucket = buckets.get(key);
  const now = Date.now();
  if (!bucket || bucket.resetAt <= now || bucket.count < limit) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
