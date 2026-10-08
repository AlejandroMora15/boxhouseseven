import { loginSchema } from "@/lib/schemas";
import { normalizeDocument } from "@/lib/normalize";
import { applyAuthCookies } from "@/server/auth/cookies";
import { verifyPassword } from "@/server/auth/password";
import { createSession, findUserForLogin, sessionUserFromRow } from "@/server/auth/sessions";
import { homePathFor } from "@/server/auth/tokens";
import { AppError } from "@/server/errors";
import { clientIp, ok, publicRoute, readJson } from "@/server/http";
import { checkRateLimit, hitRateLimit, resetRateLimit } from "@/server/rate-limit";
import { getPublicInfo } from "@/server/services/settings";

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES_PER_ACCOUNT = 8;
const MAX_FAILURES_PER_IP = 40;

export const POST = publicRoute(async (req) => {
  const ip = clientIp(req);
  const input = await readJson(req, loginSchema);

  // Solo cuentan los intentos fallidos (protección contra fuerza bruta).
  const accountKey = `login:${ip}:${input.email}`;
  const ipKey = `login-ip:${ip}`;
  const perAccount = checkRateLimit(accountKey, MAX_FAILURES_PER_ACCOUNT);
  const perIp = checkRateLimit(ipKey, MAX_FAILURES_PER_IP);
  if (!perAccount.allowed || !perIp.allowed) {
    throw new AppError("RATE_LIMITED", {
      details: { retryAfterSeconds: Math.max(perAccount.retryAfterSeconds, perIp.retryAfterSeconds) },
    });
  }

  const user = await findUserForLogin(input.email);
  let valid = await verifyPassword(input.password, user?.password_hash ?? null);
  // La clave de los clientes es su documento: se acepta escrito con puntos o espacios.
  if (!valid && user?.role === "client") {
    const normalized = normalizeDocument(input.password);
    if (normalized && normalized !== input.password) valid = await verifyPassword(normalized, user.password_hash);
  }
  if (!user || !valid) {
    hitRateLimit(accountKey, MAX_FAILURES_PER_ACCOUNT, WINDOW_MS);
    hitRateLimit(ipKey, MAX_FAILURES_PER_IP, WINDOW_MS);
    throw new AppError("INVALID_CREDENTIALS");
  }

  if (!user.is_active) {
    const info = await getPublicInfo();
    throw new AppError("ACCOUNT_INACTIVE", { details: { whatsappPhone: info.whatsappPhone } });
  }

  resetRateLimit(accountKey);
  const sessionUser = sessionUserFromRow(user);
  const tokens = await createSession(sessionUser, { userAgent: req.headers.get("user-agent"), ip });

  const res = ok({ user: sessionUser, redirectTo: homePathFor(sessionUser.role) });
  applyAuthCookies(res.cookies, tokens);
  return res;
});
