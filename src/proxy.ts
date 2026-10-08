// Proxy (antes "middleware"): protege páginas y API según el rol del JWT.
//
// * Verifica el access token (JWT HS256) sin tocar la base de datos.
// * Si expiró pero hay refresh token, lo renueva de forma transparente
//   llamando a /api/auth/refresh y propaga las cookies nuevas tanto a la
//   respuesta como a la petición que sigue (para que la página/API ya vea la
//   sesión renovada).
// * Rechaza peticiones de escritura a la API con un Origin distinto (CSRF).
//
// Cada Route Handler vuelve a validar la sesión: el proxy es la primera
// barrera, no la única.
import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  homePathFor,
  verifyAccessToken,
  type AccessClaims,
} from "@/server/auth/tokens";

type Area = "root" | "login" | "admin-page" | "client-page" | "admin-api" | "client-api" | "open";

const CLIENT_PAGES = ["/agenda", "/historial", "/perfil"];

function areaOf(pathname: string): Area {
  if (pathname === "/") return "root";
  if (pathname === "/login") return "login";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin-page";
  if (CLIENT_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "client-page";
  if (pathname.startsWith("/api/admin/")) return "admin-api";
  if (pathname.startsWith("/api/me/")) return "client-api";
  return "open";
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isCrossOriginWrite(req: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return false;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

interface RefreshOutcome {
  claims: AccessClaims | null;
  setCookies: string[];
  inactive: boolean;
}

/** Renueva la sesión llamando al endpoint de refresh con las cookies actuales. */
async function tryRefresh(req: NextRequest): Promise<RefreshOutcome> {
  try {
    const res = await fetch(new URL("/api/auth/refresh", req.nextUrl.origin), {
      method: "POST",
      headers: {
        cookie: req.headers.get("cookie") ?? "",
        "user-agent": req.headers.get("user-agent") ?? "",
        "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
      },
      cache: "no-store",
    });
    const setCookies = res.headers.getSetCookie();
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
      return { claims: null, setCookies, inactive: body?.error?.code === "ACCOUNT_INACTIVE" };
    }
    const accessCookie = setCookies.find((c) => c.startsWith(`${ACCESS_COOKIE}=`));
    const token = accessCookie?.split(";")[0].slice(ACCESS_COOKIE.length + 1);
    const claims = token ? await verifyAccessToken(decodeURIComponent(token)) : null;
    return { claims, setCookies, inactive: false };
  } catch {
    return { claims: null, setCookies: [], inactive: false };
  }
}

/** Cabecera Cookie de la petición con los valores recién emitidos. */
function mergeCookieHeader(req: NextRequest, setCookies: string[]): string {
  const jar = new Map(req.cookies.getAll().map((c) => [c.name, c.value]));
  for (const raw of setCookies) {
    const [pair, ...attrs] = raw.split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const expired = attrs.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === "";
    if (expired) jar.delete(name);
    else jar.set(name, value);
  }
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

function withCookies<T extends NextResponse>(res: T, setCookies: string[]): T {
  for (const c of setCookies) res.headers.append("set-cookie", c);
  return res;
}

function loginRedirect(req: NextRequest, opts: { inactive?: boolean } = {}) {
  const url = new URL("/login", req.url);
  const next = req.nextUrl.pathname + req.nextUrl.search;
  if (next !== "/" && next !== "/login") url.searchParams.set("next", next);
  if (opts.inactive) url.searchParams.set("motivo", "inactiva");
  return NextResponse.redirect(url);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/") && isCrossOriginWrite(req)) {
    return jsonError(403, "FORBIDDEN_ORIGIN", "Solicitud no permitida.");
  }

  const area = areaOf(pathname);
  if (area === "open") return NextResponse.next();

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  let claims = accessToken ? await verifyAccessToken(accessToken) : null;
  let setCookies: string[] = [];
  let inactive = false;

  if (!claims && req.cookies.has(REFRESH_COOKIE)) {
    const refreshed = await tryRefresh(req);
    claims = refreshed.claims;
    setCookies = refreshed.setCookies;
    inactive = refreshed.inactive;
  }

  const isApi = area === "admin-api" || area === "client-api";
  const requiredRole = area === "admin-page" || area === "admin-api" ? "admin" : "client";

  let response: NextResponse;

  if (area === "root") {
    response = NextResponse.redirect(new URL(claims ? homePathFor(claims.role) : "/login", req.url));
  } else if (area === "login") {
    response = claims
      ? NextResponse.redirect(new URL(homePathFor(claims.role), req.url))
      : NextResponse.next();
  } else if (!claims) {
    response = isApi
      ? inactive
        ? jsonError(403, "ACCOUNT_INACTIVE", "Tu cuenta está inactiva. Comunícate con el administrador.")
        : jsonError(401, "UNAUTHENTICATED", "Tu sesión expiró. Inicia sesión de nuevo.")
      : loginRedirect(req, { inactive });
  } else if (claims.role !== requiredRole) {
    response = isApi
      ? jsonError(403, "FORBIDDEN", "No tienes permiso para realizar esta acción.")
      : NextResponse.redirect(new URL(homePathFor(claims.role), req.url));
  } else if (setCookies.length) {
    const headers = new Headers(req.headers);
    headers.set("cookie", mergeCookieHeader(req, setCookies));
    response = NextResponse.next({ request: { headers } });
  } else {
    response = NextResponse.next();
  }

  return withCookies(response, setCookies);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|opengraph-image|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt)$).*)",
  ],
};
