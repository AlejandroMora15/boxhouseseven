"use client";

import { useEffect } from "react";
import { readAccessExpiry, redirectToLogin, notifyInactive, refreshSession } from "@/lib/api-client";

const REFRESH_BEFORE_MS = 2 * 60_000;
const CHECK_EVERY_MS = 30_000;

/**
 * Mantiene viva la sesión: renueva el access token ~2 min antes de que
 * expire, y también al volver a la pestaña (p. ej. después de suspender el
 * equipo). Las renovaciones se coordinan entre pestañas con Web Locks.
 */
export function SessionKeeper() {
  useEffect(() => {
    let cancelled = false;

    async function check() {
      const exp = readAccessExpiry();
      if (!exp || cancelled) return;
      if (exp * 1000 - Date.now() > REFRESH_BEFORE_MS) return;
      const result = await refreshSession();
      if (cancelled) return;
      if (result === "inactive") notifyInactive();
      else if (result === "invalid") redirectToLogin();
      // "error" (sin red): se reintenta en el siguiente ciclo.
    }

    const interval = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    void check();

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, []);

  return null;
}
