import { addToClassSchema } from "@/lib/schemas";
import { ok, readJson, withAuth } from "@/server/http";
import { addClientToClass } from "@/server/services/agenda";

export const POST = withAuth("admin", async (req, { user }) => {
  const input = await readJson(req, addToClassSchema);
  await addClientToClass(user.id, input);
  return ok({ ok: true });
});
