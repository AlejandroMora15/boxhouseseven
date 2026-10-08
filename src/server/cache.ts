// Caché en memoria del proceso para datos que se leen en casi todas las
// peticiones y cambian muy poco (configuración y franjas horarias).
//
// * Las lecturas concurrentes comparten una sola consulta a la BD.
// * `invalidate` descarta el valor al guardar cambios; una carga que estaba
//   en curso durante la invalidación no deja datos viejos en la caché.
// * El TTL es un respaldo por si la BD se modifica por fuera de la app.

interface Entry {
  value?: unknown;
  expiresAt: number;
  pending?: Promise<unknown>;
}

declare global {
  var __bh7Cache: { entries: Map<string, Entry>; versions: Map<string, number> } | undefined;
}

const store = globalThis.__bh7Cache ?? (globalThis.__bh7Cache = { entries: new Map(), versions: new Map() });

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const entry = store.entries.get(key);
  if (entry && "value" in entry && entry.expiresAt > Date.now()) return Promise.resolve(entry.value as T);
  if (entry?.pending) return entry.pending as Promise<T>;

  const version = store.versions.get(key) ?? 0;
  const pending = load().then(
    (value) => {
      if ((store.versions.get(key) ?? 0) === version) {
        store.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    },
    (error: unknown) => {
      if (store.entries.get(key)?.pending === pending) store.entries.delete(key);
      throw error;
    },
  );
  store.entries.set(key, { expiresAt: 0, pending });
  return pending;
}

export function invalidate(key: string): void {
  store.versions.set(key, (store.versions.get(key) ?? 0) + 1);
  store.entries.delete(key);
}
