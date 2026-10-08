import { clientInputSchema, uuidSchema } from "@/lib/schemas";
import { noContent, ok, readJson, validate, withAuth } from "@/server/http";
import { deleteClient, getClient, updateClient } from "@/server/services/clients";

type Params = { id: string };

export const GET = withAuth<Params>("admin", async (_req, { params }) => {
  const id = validate(uuidSchema, params.id);
  return ok(await getClient(id));
});

export const PUT = withAuth<Params>("admin", async (req, { params }) => {
  const id = validate(uuidSchema, params.id);
  const input = await readJson(req, clientInputSchema);
  await updateClient(id, input);
  return ok(await getClient(id));
});

export const DELETE = withAuth<Params>("admin", async (_req, { params }) => {
  const id = validate(uuidSchema, params.id);
  await deleteClient(id);
  return noContent();
});
