import { z } from "zod";
import { slotInputSchema } from "@/lib/schemas";
import { ok, readJson, validate, withAuth } from "@/server/http";
import { deleteSlot, updateSlot } from "@/server/services/slots";

const idSchema = z.coerce.number().int().positive();

export const PUT = withAuth<{ id: string }>("admin", async (req, { params }) => {
  const id = validate(idSchema, params.id);
  const input = await readJson(req, slotInputSchema);
  return ok(await updateSlot(id, input));
});

export const DELETE = withAuth<{ id: string }>("admin", async (_req, { params }) => {
  const id = validate(idSchema, params.id);
  return ok(await deleteSlot(id));
});
