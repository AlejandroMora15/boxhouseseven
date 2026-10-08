import { adminTrialSchema, trialListQuerySchema } from "@/lib/schemas";
import { ok, readJson, readQuery, withAuth } from "@/server/http";
import { createTrialByAdmin, listTrials } from "@/server/services/trials";

export const GET = withAuth("admin", async (req) => {
  const query = readQuery(req, trialListQuerySchema);
  return ok(await listTrials(query));
});

export const POST = withAuth("admin", async (req) => {
  const input = await readJson(req, adminTrialSchema);
  return ok(await createTrialByAdmin(input), { status: 201 });
});
