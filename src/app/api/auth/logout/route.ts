import { clearAuthCookies } from "@/server/auth/cookies";
import { revokeByRefreshToken, revokeSession } from "@/server/auth/sessions";
import { ACCESS_COOKIE, REFRESH_COOKIE, verifyAccessToken } from "@/server/auth/tokens";
import { ok, publicRoute } from "@/server/http";

export const POST = publicRoute(async (req) => {
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const claims = access ? await verifyAccessToken(access) : null;

  await Promise.all([
    refresh ? revokeByRefreshToken(refresh) : null,
    claims ? revokeSession(claims.sid) : null,
  ]);

  const res = ok({ ok: true });
  clearAuthCookies(res.cookies);
  return res;
});
