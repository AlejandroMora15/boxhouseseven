import { z } from "zod";
import { todayISO } from "@/lib/dates";
import { isoDateSchema, uuidSchema } from "@/lib/schemas";
import { ok, readQuery, validate, withAuth } from "@/server/http";
import { getAttendanceHistory } from "@/server/services/client-classes";

const query = z.object({ month: isoDateSchema.optional() });

export const GET = withAuth<{ id: string }>("admin", async (req, { params }) => {
  const id = validate(uuidSchema, params.id);
  const { month } = readQuery(req, query);
  return ok(await getAttendanceHistory(id, month ?? todayISO()));
});
