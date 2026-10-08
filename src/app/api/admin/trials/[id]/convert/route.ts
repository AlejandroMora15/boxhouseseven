import { convertTrialSchema, uuidSchema } from "@/lib/schemas";
import { ok, readJson, validate, withAuth } from "@/server/http";
import { convertTrial } from "@/server/services/trials";

export const POST = withAuth<{ id: string }>("admin", async (req, { params }) => {
  const id = validate(uuidSchema, params.id);
  const input = await readJson(req, convertTrialSchema);
  return ok(await convertTrial(id, input), { status: 201 });
});
