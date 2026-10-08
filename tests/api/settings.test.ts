import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { addDaysISO } from "@/lib/dates";
import { BASE_URL, createClient, loginAdmin, refDates, Session, TEST_CLOSED_REASON } from "./helpers";

const slotId = inject("testSlotId");

describe("configuración", () => {
  let admin: Session;
  let original: Record<string, unknown>;
  const d = refDates();

  beforeAll(async () => {
    admin = await loginAdmin();
    original = (await admin.get("/api/admin/settings")).body;
  });

  afterAll(async () => {
    await admin.put("/api/admin/settings", original);
  });

  it("valida y guarda la configuración general (y se refleja de inmediato)", async () => {
    const invalid = await admin.put("/api/admin/settings", { ...original, maxPerClass: 0, whatsappPhone: "abc" });
    expect(invalid.status).toBe(422);
    expect(Object.keys(invalid.body.error.fields)).toEqual(expect.arrayContaining(["maxPerClass", "whatsappPhone"]));

    const capacity = Number(original.maxPerClass) + 1;
    const ok = await admin.put("/api/admin/settings", {
      ...original,
      maxPerClass: capacity,
      whatsappPhone: "300 123 4567",
      address: "Calle 10 # 5-20, Cartago",
    });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ maxPerClass: capacity, whatsappPhone: "3001234567" });

    // Cupo y datos de contacto se usan en el resto de la app sin reiniciar nada.
    const day = await admin.get(`/api/admin/agenda/day?date=${d.nextWed}`);
    expect(day.body.capacity).toBe(capacity);
    const info = await new Session().get("/api/public/info");
    expect(info.body).toMatchObject({ whatsappPhone: "3001234567", address: "Calle 10 # 5-20, Cartago" });

    await admin.put("/api/admin/settings", original);
    expect((await admin.get("/api/admin/settings")).body).toEqual(original);
  });

  it("franjas: crea, edita y elimina; impide solapamientos", async () => {
    const overlap = await admin.post("/api/admin/slots", { startTime: "22:30", endTime: "23:30", weekdays: [3] });
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe("SLOT_OVERLAP");

    const created = await admin.post("/api/admin/slots", { startTime: "23:10", endTime: "23:50", weekdays: [7] });
    expect(created.status).toBe(201);
    const id = created.body.id;
    const listed = await admin.get("/api/admin/slots");
    expect(listed.body.items.some((s: { id: number }) => s.id === id)).toBe(true);

    const edited = await admin.put(`/api/admin/slots/${id}`, { startTime: "23:05", endTime: "23:55", weekdays: [6, 7] });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ startTime: "23:05", endTime: "23:55", weekdays: [6, 7] });

    const badRange = await admin.put(`/api/admin/slots/${id}`, { startTime: "23:30", endTime: "23:00", weekdays: [7] });
    expect(badRange.status).toBe(422);

    const removed = await admin.delete(`/api/admin/slots/${id}`);
    expect(removed.status).toBe(200);
    expect(removed.body.archived).toBe(false);
    expect((await admin.delete(`/api/admin/slots/${id}`)).status).toBe(404);
  });

  it("una petición cancelada mientras se recarga la caché no bloquea a las siguientes", async () => {
    // Crear y borrar una franja invalida la caché de horarios.
    const created = await admin.post("/api/admin/slots", { startTime: "23:10", endTime: "23:50", weekdays: [7] });
    await admin.delete(`/api/admin/slots/${created.body.id}`);

    for (let i = 0; i < 3; i++) {
      const controller = new AbortController();
      const aborted = fetch(`${BASE_URL}/api/admin/slots`, {
        headers: { cookie: admin.cookieHeader(), "x-forwarded-for": admin.ip },
        signal: controller.signal,
      }).catch(() => null);
      setTimeout(() => controller.abort(), 5);
      await aborted;
    }

    const started = Date.now();
    const [slots, week] = await Promise.all([
      admin.get("/api/admin/slots"),
      admin.get(`/api/admin/agenda/week?date=${d.nextWed}`),
    ]);
    expect(slots.status).toBe(200);
    expect(week.status).toBe(200);
    expect(slots.body.items.some((x: { id: number }) => x.id === created.body.id)).toBe(false);
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it("no deja quitar días ni eliminar una franja que usan los clientes", async () => {
    const c = await createClient(admin, { schedule: [1, 3, 5].map((weekday) => ({ weekday, slotId })) });
    try {
      const removeMonday = await admin.put(`/api/admin/slots/${slotId}`, {
        startTime: "22:00",
        endTime: "23:00",
        weekdays: [2, 3, 4, 5, 6, 7],
      });
      expect(removeMonday.status).toBe(409);
      expect(removeMonday.body.error.code).toBe("SLOT_IN_USE");
      expect(removeMonday.body.error.message).toMatch(/Lunes/);

      const del = await admin.delete(`/api/admin/slots/${slotId}`);
      expect(del.status).toBe(409);
      expect(del.body.error.code).toBe("SLOT_IN_USE");
    } finally {
      await admin.delete(`/api/admin/clients/${c.id}`);
    }
  });

  it("días cerrados: alta masiva, duplicados y eliminación", async () => {
    const days = [addDaysISO(d.nextNextMon, 30), addDaysISO(d.nextNextMon, 31)];
    const bulk = await admin.post("/api/admin/closed-days", {
      days: days.map((day) => ({ day, reason: TEST_CLOSED_REASON })),
    });
    expect(bulk.status).toBe(201);
    expect(bulk.body.added).toHaveLength(2);

    const repeated = await admin.post("/api/admin/closed-days", { days: [{ day: days[0], reason: TEST_CLOSED_REASON }] });
    expect(repeated.status).toBe(409);
    expect(repeated.body.error.code).toBe("DAY_ALREADY_CLOSED");

    const partial = await admin.post("/api/admin/closed-days", {
      days: [days[0], addDaysISO(days[1], 1)].map((day) => ({ day, reason: TEST_CLOSED_REASON })),
    });
    expect(partial.body).toMatchObject({ skipped: 1 });

    const list = await admin.get(`/api/admin/closed-days?from=${days[0]}&to=${addDaysISO(days[1], 1)}`);
    expect(list.body.items).toHaveLength(3);
    for (const item of list.body.items) {
      expect((await admin.delete(`/api/admin/closed-days/${item.day}`)).status).toBe(204);
    }
    expect((await admin.delete(`/api/admin/closed-days/${days[0]}`)).status).toBe(404);
    expect((await admin.post("/api/admin/closed-days", { days: [{ day: days[0], reason: "" }] })).status).toBe(422);
  });
});
