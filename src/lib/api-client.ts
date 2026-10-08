"use client";

// Cliente HTTP del navegador para la API interna.
// * Si una petición responde 401, intenta renovar la sesión una sola vez
//   (deduplicado entre peticiones y entre pestañas) y la reintenta.
// * Si la cuenta quedó inactiva, emite el evento "bh7:inactive".
import { errorMessage, type ApiErrorBody, type ErrorCode } from "./errors";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | "NETWORK",
    message: string,
    readonly fields?: Record<string, string>,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const INACTIVE_EVENT = "bh7:inactive";
const EXPIRY_COOKIE = "bh7_exp";

export function readAccessExpiry(): number | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${EXPIRY_COOKIE}=(\\d+)`));
  return match ? Number(match[1]) : null;
}

export function notifyInactive(details?: unknown) {
  window.dispatchEvent(new CustomEvent(INACTIVE_EVENT, { detail: details }));
}

export function redirectToLogin() {
  const next = window.location.pathname + window.location.search;
  // Recarga completa a propósito: limpia todo el estado en memoria de la sesión.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

type RefreshResult = "ok" | "invalid" | "inactive" | "error";
let refreshing: Promise<RefreshResult> | null = null;

async function doRefresh(): Promise<RefreshResult> {
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
    if (res.ok) return "ok";
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    if (body?.error?.code === "ACCOUNT_INACTIVE") return "inactive";
    return "invalid";
  } catch {
    return "error";
  }
}

/** Renueva la sesión (una sola vez aunque varias peticiones lo pidan). */
export function refreshSession(): Promise<RefreshResult> {
  if (!refreshing) {
    const run = async (): Promise<RefreshResult> => {
      // Otra pestaña pudo haber renovado mientras esperábamos el lock.
      const exp = readAccessExpiry();
      if (exp && exp * 1000 - Date.now() > 2 * 60_000) return "ok";
      return doRefresh();
    };
    const locked: Promise<RefreshResult> =
      typeof navigator !== "undefined" && "locks" in navigator
        ? navigator.locks.request("bh7-refresh", run).then((r) => r)
        : doRefresh();
    const pending = locked.finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
    refreshing = pending;
    return pending;
  }
  return refreshing;
}

interface RequestOptions {
  signal?: AbortSignal;
  retried?: boolean;
}

async function request<T>(method: string, url: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: opts.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, "NETWORK", "No hay conexión. Revisa tu internet e intenta de nuevo.");
  }

  if (res.status === 401 && !opts.retried && !url.startsWith("/api/auth/")) {
    const result = await refreshSession();
    if (result === "ok") return request<T>(method, url, body, { ...opts, retried: true });
    if (result === "inactive") notifyInactive();
    else if (result === "invalid") redirectToLogin();
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as (T & ApiErrorBody) | null;

  if (!res.ok) {
    const err = data?.error;
    if (err?.code === "ACCOUNT_INACTIVE" && !url.startsWith("/api/auth/login")) notifyInactive(err.details);
    throw new ApiError(
      res.status,
      err?.code ?? "INTERNAL",
      err?.message ?? errorMessage(err?.code),
      err?.fields,
      err?.details,
    );
  }
  return data as T;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function withQuery(url: string, query?: Query): string {
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export const api = {
  get: <T>(url: string, query?: Query, signal?: AbortSignal) => request<T>("GET", withQuery(url, query), undefined, { signal }),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  put: <T>(url: string, body: unknown) => request<T>("PUT", url, body),
  patch: <T>(url: string, body: unknown) => request<T>("PATCH", url, body),
  delete: <T = void>(url: string) => request<T>("DELETE", url),
};
