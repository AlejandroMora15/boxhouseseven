import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { clientPayload, createClient, loginAdmin, Session, trialPayload, refDates } from "./helpers";

const slotId = inject("testSlotId");
const threeDays = [1, 3, 5].map((weekday) => ({ weekday, slotId }));
const daily = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, slotId }));

describe("gestión de clientes (admin)", () => {
  let admin: Session;
  const created: string[] = [];

  beforeAll(async () => {
    admin = await loginAdmin();
  });

  afterAll(async () => {
    for (const id of created) await admin.delete(`/api/admin/clients/${id}`);
  });

  it("valida el horario según el plan", async () => {
    const twoDays = await admin.post("/api/admin/clients", clientPayload({ schedule: threeDays.slice(0, 2) }));
    expect(twoDays.status).toBe(422);
    expect(twoDays.body.error.fields.schedule).toMatch(/3 días/);

    const dailyIncomplete = await admin.post("/api/admin/clients", clientPayload({ plan: "daily", schedule: threeDays }));
    expect(dailyIncomplete.status).toBe(422);

    const unknownSlot = await admin.post(
      "/api/admin/clients",
      clientPayload({ schedule: [1, 3, 5].map((weekday) => ({ weekday, slotId: 999999 })) }),
    );
    expect(unknownSlot.status).toBe(422);
    expect(unknownSlot.body.error.code).toBe("INVALID_SCHEDULE");
  });

  it("crea un cliente con su mensualidad y horario", async () => {
    const payload = clientPayload({ schedule: threeDays, fullName: "Josué Ñáñez Prueba" });
    const res = await admin.post("/api/admin/clients", payload);
    expect(res.status).toBe(201);
    created.push(res.body.id);

    const detail = await admin.get(`/api/admin/clients/${res.body.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      fullName: "Josué Ñáñez Prueba",
      document: payload.document,
      plan: "three_days",
      monthlyFee: 130000,
      isActive: true,
    });
    expect(detail.body.schedule).toHaveLength(3);
    expect(detail.body.schedule[0]).toMatchObject({ weekday: 1, slotId, startTime: "22:00", endTime: "23:00" });
  });

  it("no permite documentos ni correos repetidos", async () => {
    const c = await createClient(admin, { schedule: threeDays });
    created.push(c.id);
    const dupDoc = await admin.post("/api/admin/clients", clientPayload({ schedule: threeDays, document: c.document }));
    expect(dupDoc.status).toBe(409);
    expect(dupDoc.body.error.code).toBe("DOCUMENT_TAKEN");
    expect(dupDoc.body.error.fields).toHaveProperty("document");

    const dupEmail = await admin.post(
      "/api/admin/clients",
      clientPayload({ schedule: threeDays, email: c.email.toUpperCase() }),
    );
    expect(dupEmail.status).toBe(409);
    expect(dupEmail.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("lista con búsqueda sin tildes, filtros y paginación", async () => {
    const tag = `Zuluaga${Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 5)}`;
    const ids = await Promise.all(
      [0, 1, 2, 3, 4, 5].map((i) =>
        createClient(admin, {
          fullName: `Ánderson ${tag} ${"abcdef"[i]}`,
          plan: i % 2 ? "daily" : "three_days",
          monthlyFee: i % 2 ? 150000 : 130000,
          schedule: i % 2 ? daily : threeDays,
          isActive: i !== 5,
        }),
      ),
    );
    created.push(...ids.map((c) => c.id));

    const search = await admin.get(`/api/admin/clients?q=anderson ${tag.toLowerCase()}&pageSize=5`);
    expect(search.status).toBe(200);
    expect(search.body.total).toBe(6);
    expect(search.body.items).toHaveLength(5);
    expect(search.body.pageCount).toBe(2);
    const page2 = await admin.get(`/api/admin/clients?q=${tag}&pageSize=5&page=2`);
    expect(page2.body.items).toHaveLength(1);

    expect((await admin.get(`/api/admin/clients?q=${tag}&plan=daily`)).body.total).toBe(3);
    expect((await admin.get(`/api/admin/clients?q=${tag}&status=inactive`)).body.total).toBe(1);
    expect((await admin.get(`/api/admin/clients?q=${tag}&status=active`)).body.total).toBe(5);
    expect((await admin.get(`/api/admin/clients?q=${tag}&sort=recent`)).body.total).toBe(6);

    // Por documento y búsqueda rápida (para agregar a una clase).
    expect((await admin.get(`/api/admin/clients?q=${ids[2].document}`)).body.items[0].id).toBe(ids[2].id);
    const quick = await admin.get(`/api/admin/clients/search?q=${tag}`);
    expect(quick.body.items.length).toBe(6);
    expect(quick.body.items.at(-1).isActive).toBe(false); // los inactivos al final

    // Parámetros inválidos
    expect((await admin.get(`/api/admin/clients?page=0`)).status).toBe(422);
    expect((await admin.get(`/api/admin/clients?status=raro`)).status).toBe(422);
  });

  it("edita cualquier dato, incluida la modalidad", async () => {
    const c = await createClient(admin, { schedule: threeDays });
    created.push(c.id);
    const res = await admin.put(`/api/admin/clients/${c.id}`, {
      ...clientPayload(),
      fullName: "Nombre Editado",
      document: c.document,
      email: c.email,
      phone: "3209998877",
      plan: "daily",
      monthlyFee: 150000,
      schedule: daily,
      notes: "Cambió a diario",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      fullName: "Nombre Editado",
      phone: "3209998877",
      plan: "daily",
      monthlyFee: 150000,
      notes: "Cambió a diario",
    });
    expect(res.body.schedule).toHaveLength(5);
  });

  it("cambia el estado y elimina (sin gestión de pagos)", async () => {
    const c = await createClient(admin, { schedule: threeDays });
    const detail = (await admin.get(`/api/admin/clients/${c.id}`)).body;
    expect(detail).not.toHaveProperty("nextPaymentDate");
    expect((await admin.post(`/api/admin/clients/${c.id}/payment`)).status).toBe(404);
    expect((await admin.get(`/api/admin/clients?payment=overdue`)).status).toBe(200);

    expect((await admin.patch(`/api/admin/clients/${c.id}/status`, { isActive: false })).status).toBe(200);
    expect((await admin.get(`/api/admin/clients/${c.id}`)).body.isActive).toBe(false);

    expect((await admin.delete(`/api/admin/clients/${c.id}`)).status).toBe(204);
    expect((await admin.get(`/api/admin/clients/${c.id}`)).status).toBe(404);
    expect((await admin.delete(`/api/admin/clients/${c.id}`)).status).toBe(404);
  });

  it("responde 404/422 ante identificadores inexistentes o inválidos", async () => {
    expect((await admin.get("/api/admin/clients/00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await admin.get("/api/admin/clients/no-es-uuid")).status).toBe(422);
  });

  it("si se crea un cliente que había agendado prueba, la prueba queda convertida", async () => {
    const { nextFri } = refDates();
    const person = trialPayload();
    const trial = await admin.post("/api/admin/trials", { ...person, classDate: nextFri, slotId, notes: null });
    expect(trial.status).toBe(201);

    const c = await createClient(admin, {
      fullName: person.fullName,
      document: person.document,
      email: person.email,
      phone: person.phone,
      schedule: threeDays,
    });
    created.push(c.id);

    const list = await admin.get(`/api/admin/trials?q=${person.document}`);
    expect(list.body.items[0]).toMatchObject({ status: "converted", convertedClientId: c.id });
    const detail = await admin.get(`/api/admin/clients/${c.id}`);
    expect(detail.body.trial).toMatchObject({ id: trial.body.id, classDate: nextFri });
  });
});
