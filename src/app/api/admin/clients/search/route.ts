import { z } from "zod";
import { ok, readQuery, withAuth } from "@/server/http";
import { searchClients } from "@/server/services/clients";

const query = z.object({ q: z.string().trim().max(100).default("") });

export const GET = withAuth("admin", async (req) => {
  const { q } = readQuery(req, query);
  return ok({ items: await searchClients(q) });
});
