import { attendanceInputSchema } from "@/lib/schemas";
import { ok, readJson, withAuth } from "@/server/http";
import { setClientAttendance, setTrialAttendance } from "@/server/services/agenda";

export const POST = withAuth("admin", async (req, { user }) => {
  const input = await readJson(req, attendanceInputSchema);
  if (input.clientId) {
    await setClientAttendance(user.id, { ...input, clientId: input.clientId });
  } else if (input.trialId) {
    await setTrialAttendance({ ...input, trialId: input.trialId });
  }
  return ok({ ok: true });
});
