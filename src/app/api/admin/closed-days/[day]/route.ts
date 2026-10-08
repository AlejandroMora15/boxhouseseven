import { isoDateSchema } from "@/lib/schemas";
import { noContent, validate, withAuth } from "@/server/http";
import { removeClosedDay } from "@/server/services/closed-days";

export const DELETE = withAuth<{ day: string }>("admin", async (_req, { params }) => {
  await removeClosedDay(validate(isoDateSchema, params.day));
  return noContent();
});
