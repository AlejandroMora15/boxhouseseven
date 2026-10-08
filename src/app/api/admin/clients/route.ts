import { clientInputSchema, clientListQuerySchema } from "@/lib/schemas";
import { ok, readJson, readQuery, withAuth } from "@/server/http";
import { createClient, listClients } from "@/server/services/clients";

export const GET = withAuth("admin", async (req) => {
  const query = readQuery(req, clientListQuerySchema);
  return ok(await listClients(query));
});

export const POST = withAuth("admin", async (req) => {
  const input = await readJson(req, clientInputSchema);
  const created = await createClient(input);
  return ok(created, { status: 201 });
});
