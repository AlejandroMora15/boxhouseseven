import { trialUpdateSchema, uuidSchema } from "@/lib/schemas";
import { noContent, ok, readJson, validate, withAuth } from "@/server/http";
import { deleteTrial, getTrial, updateTrial } from "@/server/services/trials";

type Params = { id: string };

export const GET = withAuth<Params>("admin", async (_req, { params }) => {
  return ok(await getTrial(validate(uuidSchema, params.id)));
});

export const PUT = withAuth<Params>("admin", async (req, { params }) => {
  const id = validate(uuidSchema, params.id);
  const input = await readJson(req, trialUpdateSchema);
  return ok(await updateTrial(id, input));
});

export const DELETE = withAuth<Params>("admin", async (_req, { params }) => {
  await deleteTrial(validate(uuidSchema, params.id));
  return noContent();
});
