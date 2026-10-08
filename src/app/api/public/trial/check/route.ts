import { trialPersonSchema } from "@/lib/schemas";
import { AppError } from "@/server/errors";
import { clientIp, ok, publicRoute, readJson } from "@/server/http";
import { hitRateLimit } from "@/server/rate-limit";
import { assertNotRegistered } from "@/server/services/trials";

// Paso 1 del flujo público: validar que la persona no exista.
export const POST = publicRoute(async (req) => {
  const limit = hitRateLimit(`trial-check:${clientIp(req)}`, 20, 10 * 60_000);
  if (!limit.allowed) throw new AppError("RATE_LIMITED");
  const input = await readJson(req, trialPersonSchema);
  await assertNotRegistered(input.document, input.email);
  return ok({ ok: true });
});
