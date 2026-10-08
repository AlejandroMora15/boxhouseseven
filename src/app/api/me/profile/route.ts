import { ok, withAuth } from "@/server/http";
import { getMyProfile } from "@/server/services/me";

export const GET = withAuth("client", async (_req, { user }) => ok(await getMyProfile(user.id)));
