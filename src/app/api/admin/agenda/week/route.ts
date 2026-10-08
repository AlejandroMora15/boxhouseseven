import { z } from "zod";
import { isoDateSchema } from "@/lib/schemas";
import { ok, readQuery, withAuth } from "@/server/http";
import { getAgendaWeek } from "@/server/services/agenda";

const query = z.object({ date: isoDateSchema });

export const GET = withAuth("admin", async (req) => {
  const { date } = readQuery(req, query);
  return ok(await getAgendaWeek(date));
});
