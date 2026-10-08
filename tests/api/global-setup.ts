import type { TestProject } from "vitest/node";
import { adminDb, BASE_URL, cleanupTestData, loginAdmin } from "./helpers";

declare module "vitest" {
  export interface ProvidedContext {
    testSlotId: number;
  }
}

/**
 * Prepara las pruebas de API: verifica que el servidor esté arriba, limpia
 * restos de ejecuciones anteriores y crea una franja exclusiva (22:00-23:00,
 * todos los días) para no interferir con las clases reales.
 */
export default async function setup(project: TestProject) {
  const health = await fetch(`${BASE_URL}/api/public/info`).catch(() => null);
  if (!health?.ok) {
    throw new Error(`No hay servidor en ${BASE_URL}. Ejecuta "npm run dev" en otra terminal antes de "npm run test:api".`);
  }

  const sql = adminDb();
  const admin = await loginAdmin();

  await cleanupTestData(sql);
  const leftovers = await sql<{ id: number }[]>`
    select id from public.time_slots where start_time = '22:00' and is_active
  `;
  for (const s of leftovers) await admin.delete(`/api/admin/slots/${s.id}`);

  const slot = await admin.post<{ id: number }>("/api/admin/slots", {
    startTime: "22:00",
    endTime: "23:00",
    weekdays: [1, 2, 3, 4, 5, 6, 7],
  });
  if (slot.status !== 201) throw new Error(`No se pudo crear la franja de prueba: ${JSON.stringify(slot.body)}`);
  project.provide("testSlotId", slot.body.id);

  return async () => {
    await cleanupTestData(sql);
    // Las referencias ya se borraron: la franja se elimina (o archiva) vía API
    // para que el servidor invalide su caché de horarios.
    await admin.delete(`/api/admin/slots/${slot.body.id}`);
    await sql`delete from public.time_slots where id = ${slot.body.id} and not is_active
      and not exists (select 1 from public.attendance where slot_id = ${slot.body.id})`.catch(() => {});
    await admin.post("/api/auth/logout");
    await sql.end();
  };
}
