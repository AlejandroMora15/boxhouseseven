import { settingsSchema } from "@/lib/schemas";
import { ok, readJson, withAuth } from "@/server/http";
import { getSettings, updateSettings } from "@/server/services/settings";

export const GET = withAuth("admin", async () => ok(await getSettings()));

export const PUT = withAuth("admin", async (req) => {
  const input = await readJson(req, settingsSchema);
  return ok(await updateSettings(input));
});
