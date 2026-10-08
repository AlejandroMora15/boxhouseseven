import { rescheduleSchema } from "@/lib/schemas";
import { ok, readJson, withAuth } from "@/server/http";
import { rescheduleMyClass } from "@/server/services/me";

export const POST = withAuth("client", async (req, { user }) => {
  const input = await readJson(req, rescheduleSchema);
  await rescheduleMyClass(user.id, input);
  return ok({ ok: true });
});
