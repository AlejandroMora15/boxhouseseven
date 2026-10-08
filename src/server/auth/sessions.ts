// Sesiones con refresh tokens rotativos.
//
// * El refresh token es un valor aleatorio de 256 bits; en BD solo se guarda
//   su hash SHA-256.
// * Cada renovación rota el token. El token anterior se acepta durante un
//   margen corto (GRACE_SECONDS) para tolerar peticiones paralelas (varias
//   pestañas) sin cerrar la sesión; en ese caso solo se emite un access token.
// * Cerrar sesión revoca la fila: el refresh deja de servir y los access
//   tokens asociados (claim `sid`) se rechazan en la siguiente validación.
import { createHash, randomBytes } from "node:crypto";
import type { Role, SessionUser } from "@/lib/types";
import { sql } from "../db";
import { REFRESH_TTL_SECONDS, signAccessToken } from "./tokens";
import type { IssuedTokens } from "./cookies";

const GRACE_SECONDS = 30;
const VALIDATION_TTL_MS = 30_000;

interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

interface UserRow {
  id: string;
  role: Role;
  email: string;
  full_name: string;
  is_active: boolean;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

async function issueAccess(user: SessionUser, sessionId: string) {
  return signAccessToken({
    sub: user.id,
    sid: sessionId,
    role: user.role,
    name: user.name,
    email: user.email,
  });
}

function toSessionUser(row: UserRow): SessionUser {
  return { id: row.id, role: row.role, name: row.full_name, email: row.email };
}

export async function createSession(
  user: SessionUser,
  meta: SessionMeta,
): Promise<IssuedTokens & { sessionId: string }> {
  const refreshToken = newRefreshToken();
  const [row] = await sql<{ id: string }[]>`
    with cleanup as (
      delete from public.sessions
      where user_id = ${user.id}
        and (expires_at < now() or revoked_at < now() - interval '1 day')
    )
    insert into public.sessions (user_id, refresh_hash, expires_at, user_agent, ip)
    values (
      ${user.id},
      ${hashToken(refreshToken)},
      now() + make_interval(secs => ${REFRESH_TTL_SECONDS}),
      ${meta.userAgent?.slice(0, 300) ?? null},
      ${meta.ip ?? null}
    )
    returning id
  `;
  const access = await issueAccess(user, row.id);
  return {
    sessionId: row.id,
    accessToken: access.token,
    accessExpiresAt: access.expiresAt,
    refreshToken,
  };
}

export type RefreshResult =
  | { status: "ok"; user: SessionUser; tokens: IssuedTokens }
  | { status: "inactive" }
  | { status: "invalid" };

export async function refreshSession(refreshToken: string, meta: SessionMeta): Promise<RefreshResult> {
  if (!refreshToken || refreshToken.length > 200) return { status: "invalid" };
  const oldHash = hashToken(refreshToken);
  const nextToken = newRefreshToken();

  // 1) Rotación normal.
  const rotated = await sql<(UserRow & { session_id: string })[]>`
    with s as (
      update public.sessions
      set prev_refresh_hash = refresh_hash,
          refresh_hash = ${hashToken(nextToken)},
          rotated_at = now(),
          last_used_at = now(),
          expires_at = now() + make_interval(secs => ${REFRESH_TTL_SECONDS}),
          user_agent = coalesce(${meta.userAgent?.slice(0, 300) ?? null}, user_agent),
          ip = coalesce(${meta.ip ?? null}, ip)
      where refresh_hash = ${oldHash}
        and revoked_at is null
        and expires_at > now()
      returning id, user_id
    )
    select s.id as session_id, u.id, u.role, u.email, u.full_name, u.is_active
    from s join public.users u on u.id = s.user_id
  `;

  let row = rotated[0];
  let rotatedNow = true;

  // 2) Token recién rotado por otra petición concurrente (margen de gracia).
  if (!row) {
    const grace = await sql<(UserRow & { session_id: string })[]>`
      select s.id as session_id, u.id, u.role, u.email, u.full_name, u.is_active
      from public.sessions s
      join public.users u on u.id = s.user_id
      where s.prev_refresh_hash = ${oldHash}
        and s.revoked_at is null
        and s.expires_at > now()
        and s.rotated_at > now() - make_interval(secs => ${GRACE_SECONDS})
    `;
    row = grace[0];
    rotatedNow = false;
  }

  if (!row) return { status: "invalid" };

  if (!row.is_active) {
    await revokeSession(row.session_id);
    return { status: "inactive" };
  }

  const user = toSessionUser(row);
  const access = await issueAccess(user, row.session_id);
  forgetValidation(row.session_id);
  return {
    status: "ok",
    user,
    tokens: {
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshToken: rotatedNow ? nextToken : undefined,
    },
  };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await sql`update public.sessions set revoked_at = now() where id = ${sessionId} and revoked_at is null`;
  forgetValidation(sessionId);
}

/** Cierra la sesión a la que pertenece un refresh token (actual o anterior). */
export async function revokeByRefreshToken(refreshToken: string): Promise<void> {
  const hash = hashToken(refreshToken);
  const rows = await sql<{ id: string }[]>`
    update public.sessions
    set revoked_at = now()
    where (refresh_hash = ${hash} or prev_refresh_hash = ${hash}) and revoked_at is null
    returning id
  `;
  for (const r of rows) forgetValidation(r.id);
}

export async function findUserForLogin(email: string) {
  const [row] = await sql<(UserRow & { password_hash: string })[]>`
    select id, role, email, full_name, is_active, password_hash
    from public.users
    where email = ${email}
  `;
  return row ?? null;
}

export function sessionUserFromRow(row: UserRow): SessionUser {
  return toSessionUser(row);
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await sql`update public.sessions set revoked_at = now() where user_id = ${userId} and revoked_at is null`;
  for (const [sid, entry] of validationCache) {
    if (entry.userId === userId) validationCache.delete(sid);
  }
}

// ---------------------------------------------------------------------------
// Validación de sesión para cada petición autenticada (con caché corta para
// no consultar la BD en cada request; se invalida al cerrar sesión).
// ---------------------------------------------------------------------------

interface ValidationEntry {
  valid: boolean;
  userId: string;
  checkedAt: number;
}

declare global {
  var __bh7SessionCache: Map<string, ValidationEntry> | undefined;
}

const validationCache: Map<string, ValidationEntry> =
  globalThis.__bh7SessionCache ?? (globalThis.__bh7SessionCache = new Map());

function forgetValidation(sessionId: string) {
  validationCache.delete(sessionId);
}

/** Olvida en caché todas las sesiones de un usuario (p. ej. al inactivarlo). */
export function forgetUserValidations(userId: string): void {
  for (const [sid, entry] of validationCache) {
    if (entry.userId === userId) validationCache.delete(sid);
  }
}

export async function isSessionValid(sessionId: string, userId: string): Promise<boolean> {
  const cached = validationCache.get(sessionId);
  if (cached && cached.userId === userId && Date.now() - cached.checkedAt < VALIDATION_TTL_MS) {
    return cached.valid;
  }
  const [row] = await sql<{ valid: boolean }[]>`
    select (s.revoked_at is null and s.expires_at > now() and u.is_active) as valid
    from public.sessions s
    join public.users u on u.id = s.user_id
    where s.id = ${sessionId} and s.user_id = ${userId}
  `;
  const valid = Boolean(row?.valid);
  if (validationCache.size > 5000) validationCache.clear();
  validationCache.set(sessionId, { valid, userId, checkedAt: Date.now() });
  return valid;
}
