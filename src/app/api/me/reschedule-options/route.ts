import { z } from "zod";
import { isoDateSchema } from "@/lib/schemas";
import { ok, readQuery, withAuth } from "@/server/http";
import { getRescheduleOptions } from "@/server/services/me";

const query = z.object({ date: isoDateSchema, slotId: z.coerce.number().int().positive() });

export const GET = withAuth("client", async (req, { user }) => {
  const { date, slotId } = readQuery(req, query);
  return ok(await getRescheduleOptions(user.id, date, slotId));
});
