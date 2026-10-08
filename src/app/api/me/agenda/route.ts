import { z } from "zod";
import { todayISO } from "@/lib/dates";
import { isoDateSchema } from "@/lib/schemas";
import { ok, readQuery, withAuth } from "@/server/http";
import { getMyAgenda } from "@/server/services/me";

const query = z.object({ date: isoDateSchema.optional() });

export const GET = withAuth("client", async (req, { user }) => {
  const { date } = readQuery(req, query);
  return ok(await getMyAgenda(user.id, date ?? todayISO()));
});
