"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Updates = Record<string, string | number | null | undefined>;

/**
 * Estado sincronizado con la URL (fecha, vista, filtros, página...).
 * Usa la History API nativa, que Next.js integra con useSearchParams, para
 * cambiar parámetros sin ir al servidor: la navegación entre días es inmediata
 * y los enlaces se pueden compartir o recargar.
 */
export function useUrlState() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = useCallback(
    (updates: Updates, opts: { push?: boolean } = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") params.delete(key);
        else params.set(key, String(value));
      }
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (opts.push) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [pathname, searchParams],
  );

  const get = useCallback((key: string) => searchParams.get(key), [searchParams]);

  return { get, set, searchParams };
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Hora actual que se actualiza cada `intervalMs` (para estados "en curso"). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
