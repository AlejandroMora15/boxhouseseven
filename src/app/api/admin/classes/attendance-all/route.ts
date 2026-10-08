import { classAttendanceSchema } from "@/lib/schemas";
import { ok, readJson, withAuth } from "@/server/http";
import { setClassAttendance } from "@/server/services/agenda";

export const POST = withAuth("admin", async (req, { user }) => {
  const input = await readJson(req, classAttendanceSchema);
  const updated = await setClassAttendance(user.id, input);
  return ok({ updated });
});
