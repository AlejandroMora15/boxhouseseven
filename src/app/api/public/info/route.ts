import { connection } from "next/server";
import { ok, publicRoute } from "@/server/http";
import { getSettings } from "@/server/services/settings";

export const GET = publicRoute(async () => {
  await connection();
  const s = await getSettings();
  return ok({
    whatsappPhone: s.whatsappPhone,
    address: s.address,
    maxPerClass: s.maxPerClass,
    trialWindowDays: s.trialWindowDays,
  });
});
