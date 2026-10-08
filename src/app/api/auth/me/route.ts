import { ok, withAuth } from "@/server/http";

export const GET = withAuth("any", async (_req, { user }) => ok({ user }));
