// Firma y verificación de JWT de acceso (HS256) con `jose`.
// Este módulo solo usa Web Crypto: es seguro importarlo desde proxy.ts.
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@/lib/types";

export const ACCESS_COOKIE = "bh7_at";
export const REFRESH_COOKIE = "bh7_rt";
/** Cookie legible por JS con la expiración del access token (epoch en s). */
export const EXPIRY_COOKIE = "bh7_exp";

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

const ISSUER = "boxhouseseven";
const AUDIENCE = "boxhouseseven-app";

export interface AccessClaims {
  sub: string;
  sid: string;
  role: Role;
  name: string;
  email: string;
}

let cachedKey: Uint8Array | null = null;

function secretKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET no está configurada o es demasiado corta (mínimo 32 caracteres).");
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export async function signAccessToken(
  claims: AccessClaims,
): Promise<{ token: string; expiresAt: number }> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ACCESS_TTL_SECONDS;
  const token = await new SignJWT({
    sid: claims.sid,
    role: claims.role,
    name: claims.name,
    email: claims.email,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .setJti(crypto.randomUUID())
    .sign(secretKey());
  return { token, expiresAt };
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });
    const { sub, sid, role, name, email } = payload as Record<string, unknown>;
    if (
      typeof sub !== "string" ||
      typeof sid !== "string" ||
      (role !== "admin" && role !== "client") ||
      typeof name !== "string" ||
      typeof email !== "string"
    ) {
      return null;
    }
    return { sub, sid, role, name, email };
  } catch {
    return null;
  }
}

export function homePathFor(role: Role): string {
  return role === "admin" ? "/admin/agenda" : "/agenda";
}
