import { applyAuthCookies, clearAuthCookies } from "@/server/auth/cookies";
import { refreshSession } from "@/server/auth/sessions";
import { REFRESH_COOKIE } from "@/server/auth/tokens";
import { AppError } from "@/server/errors";
import { clientIp, errorResponse, ok, publicRoute } from "@/server/http";

export const POST = publicRoute(async (req) => {
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  const result = token
    ? await refreshSession(token, { userAgent: req.headers.get("user-agent"), ip: clientIp(req) })
    : ({ status: "invalid" } as const);

  if (result.status === "ok") {
    const res = ok({ user: result.user, accessExpiresAt: result.tokens.accessExpiresAt });
    applyAuthCookies(res.cookies, result.tokens);
    return res;
  }

  const res = errorResponse(new AppError(result.status === "inactive" ? "ACCOUNT_INACTIVE" : "SESSION_INVALID"));
  clearAuthCookies(res.cookies);
  return res;
});
