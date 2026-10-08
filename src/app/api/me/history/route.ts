import { z } from "zod";
import { todayISO } from "@/lib/dates";
import { isoDateSchema } from "@/lib/schemas";
import { ok, readQuery, withAuth } from "@/server/http";
import { getAttendanceHistory } from "@/server/services/client-classes";

const query = z.object({ month: isoDateSchema.optional() });

export const GET = withAuth("client", async (req, { user }) => {
  const { month } = readQuery(req, query);
  return ok(await getAttendanceHistory(user.id, month ?? todayISO()));
});
