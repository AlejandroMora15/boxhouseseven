import { connection } from "next/server";
import { ok, publicRoute } from "@/server/http";
import { getPublicAvailability } from "@/server/services/trials";

export const GET = publicRoute(async () => {
  await connection();
  const data = await getPublicAvailability();
  return ok(data, { headers: { "Cache-Control": "no-store" } });
});
