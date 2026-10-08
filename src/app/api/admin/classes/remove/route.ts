import { removeFromClassSchema } from "@/lib/schemas";
import { ok, readJson, withAuth } from "@/server/http";
import { removeClientFromClass } from "@/server/services/agenda";

export const POST = withAuth("admin", async (req, { user }) => {
  const input = await readJson(req, removeFromClassSchema);
  await removeClientFromClass(user.id, input);
  return ok({ ok: true });
});
