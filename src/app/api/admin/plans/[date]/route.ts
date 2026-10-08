import { classPlanSchema, isoDateSchema } from "@/lib/schemas";
import { ok, readJson, validate, withAuth } from "@/server/http";
import { savePlan } from "@/server/services/plans";

export const PUT = withAuth<{ date: string }>("admin", async (req, { params, user }) => {
  const date = validate(isoDateSchema, params.date);
  const { content } = await readJson(req, classPlanSchema);
  return ok({ plan: await savePlan(date, content, user.id) });
});
