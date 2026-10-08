import { trialBookingSchema } from "@/lib/schemas";
import { AppError } from "@/server/errors";
import { clientIp, ok, publicRoute, readJson } from "@/server/http";
import { hitRateLimit } from "@/server/rate-limit";
import { bookTrialPublic } from "@/server/services/trials";

// Paso 2: agendar la clase de prueba (valida de nuevo y bloquea el cupo).
export const POST = publicRoute(async (req) => {
  const limit = hitRateLimit(`trial-book:${clientIp(req)}`, 10, 10 * 60_000);
  if (!limit.allowed) throw new AppError("RATE_LIMITED");
  const input = await readJson(req, trialBookingSchema);
  const confirmation = await bookTrialPublic(input);
  return ok(confirmation, { status: 201 });
});
