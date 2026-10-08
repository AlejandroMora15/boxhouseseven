// Escritura/borrado de las cookies de sesión. Sirve tanto para el `cookies()`
// de los Route Handlers como para `NextResponse.cookies`.
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  EXPIRY_COOKIE,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
} from "./tokens";

interface CookieWriter {
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      maxAge?: number;
    },
  ): unknown;
}

const secure = process.env.NODE_ENV === "production";

export interface IssuedTokens {
  accessToken: string;
  accessExpiresAt: number;
  /** Solo presente cuando se emitió (o rotó) el refresh token. */
  refreshToken?: string;
}

export function applyAuthCookies(cookies: CookieWriter, tokens: IssuedTokens): void {
  cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TTL_SECONDS,
  });
  cookies.set(EXPIRY_COOKIE, String(tokens.accessExpiresAt), {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TTL_SECONDS,
  });
  if (tokens.refreshToken) {
    cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_TTL_SECONDS,
    });
  }
}

export function clearAuthCookies(cookies: CookieWriter): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, EXPIRY_COOKIE]) {
    cookies.set(name, "", { path: "/", maxAge: 0, httpOnly: name !== EXPIRY_COOKIE, secure, sameSite: "lax" });
  }
}
