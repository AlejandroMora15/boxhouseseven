import { slotInputSchema } from "@/lib/schemas";
import { ok, readJson, withAuth } from "@/server/http";
import { createSlot, getSlotsWithUsage } from "@/server/services/slots";

export const GET = withAuth("admin", async () => ok({ items: await getSlotsWithUsage() }));

export const POST = withAuth("admin", async (req) => {
  const input = await readJson(req, slotInputSchema);
  return ok(await createSlot(input), { status: 201 });
});
