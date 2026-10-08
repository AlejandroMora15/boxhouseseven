import { dateRangeQuerySchema } from "@/lib/schemas";
import { diffDaysISO } from "@/lib/dates";
import { AppError } from "@/server/errors";
import { ok, readQuery, withAuth } from "@/server/http";
import { listPlans } from "@/server/services/plans";

export const GET = withAuth("admin", async (req) => {
  const { from, to } = readQuery(req, dateRangeQuerySchema);
  if (diffDaysISO(to, from) > 62) throw new AppError("VALIDATION", { message: "El rango máximo es de 2 meses." });
  return ok({ items: await listPlans(from, to) });
});
