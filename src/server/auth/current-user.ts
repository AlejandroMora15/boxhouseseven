import { cookies } from "next/headers";
import type { Role, SessionUser } from "@/lib/types";
import { AppError } from "../errors";
import { isSessionValid } from "./sessions";
import { ACCESS_COOKIE, verifyAccessToken } from "./tokens";

export interface CurrentSession {
  user: SessionUser;
  sessionId: string;
}

/** Lee y valida la sesión de la petición actual (o null si no hay). */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims) return null;
  if (!(await isSessionValid(claims.sid, claims.sub))) return null;

  return {
    sessionId: claims.sid,
    user: { id: claims.sub, role: claims.role, name: claims.name, email: claims.email },
  };
}

/** Exige sesión válida y, opcionalmente, un rol específico. */
export async function requireUser(role?: Role): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) throw new AppError("UNAUTHENTICATED");
  if (role && session.user.role !== role) throw new AppError("FORBIDDEN");
  return session.user;
}
