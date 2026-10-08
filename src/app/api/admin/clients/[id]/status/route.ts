import { clientStatusSchema, uuidSchema } from "@/lib/schemas";
import { ok, readJson, validate, withAuth } from "@/server/http";
import { setClientStatus } from "@/server/services/clients";

export const PATCH = withAuth<{ id: string }>("admin", async (req, { params }) => {
  const id = validate(uuidSchema, params.id);
  const { isActive } = await readJson(req, clientStatusSchema);
  await setClientStatus(id, isActive);
  return ok({ isActive });
});
