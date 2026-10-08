import { closedDaysSchema, dateRangeQuerySchema } from "@/lib/schemas";
import { ok, readJson, readQuery, withAuth } from "@/server/http";
import { addClosedDays, listClosedDays } from "@/server/services/closed-days";

export const GET = withAuth("admin", async (req) => {
  const { from, to } = readQuery(req, dateRangeQuerySchema);
  return ok({ items: await listClosedDays(from, to) });
});

export const POST = withAuth("admin", async (req) => {
  const input = await readJson(req, closedDaysSchema);
  return ok(await addClosedDays(input), { status: 201 });
});
