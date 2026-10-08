import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { addDaysISO } from "@/lib/dates";
import {
  createClient,
  getClass,
  login,
  loginAdmin,
  refDates,
  Session,
  TEST_CLOSED_REASON,
  trialPayload,
} from "./helpers";

const slotId = inject("testSlotId");

/** Llena una clase con clientes (agregados por el admin) hasta `target`. */
async function fillClass(admin: Session, date: string, target: number, track: string[]) {
  const klass = await getClass(admin, date, slotId);
  const missing = target - (klass?.booked ?? 0);
  const clients = await Promise.all(
    Array.from({ length: Math.max(0, missing) }, (_, i) =>
      createClient(admin, {
        fullName: `Relleno ${"abcdefghijklmnop"[i]} Cupo`,
        schedule: [1, 3, 5].map((weekday) => ({ weekday, slotId })),
        startDate: addDaysISO(date, 30),
      }),
    ),
  );
  for (const c of clients) {
    track.push(c.id);
    await admin.post("/api/admin/classes/add", { date, slotId, clientId: c.id, markPresent: false });
  }
}

describe("clases de prueba: flujo público y gestión", () => {
  let admin: Session;
  let capacity: number;
  let windowDays: number;
  const d = refDates();
  const clients: string[] = [];

  beforeAll(async () => {
    admin = await loginAdmin();
    const settings = (await admin.get("/api/admin/settings")).body;
    capacity = settings.maxPerClass;
    windowDays = settings.trialWindowDays;
  });

  afterAll(async () => {
    for (const id of clients) await admin.delete(`/api/admin/clients/${id}`);
  });

  it("paso 1: valida que la persona no sea cliente ni haya agendado antes", async () => {
    const visitor = new Session();
    const fresh = await visitor.post("/api/public/trial/check", trialPayload());
    expect(fresh.status).toBe(200);

    const client = await createClient(admin, { schedule: [1, 3, 5].map((weekday) => ({ weekday, slotId })) });
    clients.push(client.id);
    const byDoc = await visitor.post("/api/public/trial/check", trialPayload({ document: client.document }));
    expect(byDoc.status).toBe(409);
    expect(byDoc.body.error.code).toBe("ALREADY_CLIENT");
    const byEmail = await visitor.post("/api/public/trial/check", trialPayload({ email: client.email.toUpperCase() }));
    expect(byEmail.body.error.code).toBe("ALREADY_CLIENT");

    const invalid = await visitor.post("/api/public/trial/check", { fullName: "x", document: "1", phone: "2", email: "3" });
    expect(invalid.status).toBe(422);
    expect(Object.keys(invalid.body.error.fields)).toEqual(expect.arrayContaining(["fullName", "document", "phone", "email"]));
  });

  it("muestra la disponibilidad sin datos personales de los asistentes", async () => {
    const res = await new Session().get("/api/public/availability");
    expect(res.status).toBe(200);
    expect(res.body.days.length).toBeGreaterThan(0);
    const thu = res.body.days.find((x: { date: string }) => x.date === d.nextThu);
    const slot = thu.slots.find((s: { slotId: number }) => s.slotId === slotId);
    expect(slot).toMatchObject({ startTime: "22:00", bookable: true });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/@|fullName|document|phone/);
    // Solo días dentro de la ventana configurada.
    expect(res.body.days.at(-1).date <= addDaysISO(d.today, windowDays)).toBe(true);
  });

  it("agenda la clase de prueba y no permite repetir", async () => {
    const person = trialPayload();
    const visitor = new Session();
    const res = await visitor.post("/api/public/trial", { ...person, classDate: d.nextThu, slotId });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ classDate: d.nextThu, startTime: "22:00", endTime: "23:00" });

    const klass = await getClass(admin, d.nextThu, slotId);
    expect(klass!.attendees.some((a) => a.type === "trial" && a.document === person.document)).toBe(true);

    const again = await new Session().post("/api/public/trial", { ...person, classDate: d.nextFri, slotId });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ALREADY_TRIAL");
    const check = await new Session().post("/api/public/trial/check", { ...trialPayload(), email: person.email });
    expect(check.body.error.code).toBe("ALREADY_TRIAL");
  });

  it("rechaza bots, clases inexistentes, días cerrados, horarios pasados y fechas fuera de ventana", async () => {
    const book = (overrides: Record<string, unknown>) =>
      new Session().post("/api/public/trial", { ...trialPayload(), classDate: d.nextFri, slotId, ...overrides });

    expect((await book({ website: "http://spam.example" })).status).toBe(422);
    expect((await book({ slotId: 999999 })).body.error.code).toBe("INVALID_CLASS");
    expect((await book({ classDate: d.yesterday })).body.error.code).toBe("CLASS_TOO_SOON");
    expect((await book({ classDate: addDaysISO(d.today, windowDays + 1) })).body.error.code).toBe("OUT_OF_WINDOW");

    await admin.post("/api/admin/closed-days", { days: [{ day: d.nextFri, reason: TEST_CLOSED_REASON }] });
    try {
      const closed = await book({});
      expect(closed.status).toBe(409);
      expect(closed.body.error.code).toBe("DAY_CLOSED");
      const availability = await new Session().get("/api/public/availability");
      const fri = availability.body.days.find((x: { date: string }) => x.date === d.nextFri);
      expect(fri.closedReason).toBe(TEST_CLOSED_REASON);
      expect(fri.slots.every((s: { bookable: boolean }) => !s.bookable)).toBe(true);
    } finally {
      await admin.delete(`/api/admin/closed-days/${d.nextFri}`);
    }
  });

  it("respeta el cupo máximo: con la clase llena no se puede agendar", async () => {
    await fillClass(admin, d.nextThu, capacity, clients);
    const klass = await getClass(admin, d.nextThu, slotId);
    expect(klass!.booked).toBe(capacity);

    const res = await new Session().post("/api/public/trial", { ...trialPayload(), classDate: d.nextThu, slotId });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CLASS_FULL");

    const availability = await new Session().get("/api/public/availability");
    const slot = availability.body.days
      .find((x: { date: string }) => x.date === d.nextThu)
      .slots.find((s: { slotId: number }) => s.slotId === slotId);
    expect(slot).toMatchObject({ available: 0, bookable: false });
  });

  it("concurrencia: varias personas por el último cupo → solo una lo obtiene", async () => {
    await fillClass(admin, d.nextFri, capacity - 1, clients);
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () =>
        new Session().post("/api/public/trial", { ...trialPayload(), classDate: d.nextFri, slotId }),
      ),
    );
    const ok = attempts.filter((r) => r.status === 201);
    const full = attempts.filter((r) => r.status === 409 && r.body.error.code === "CLASS_FULL");
    expect(ok).toHaveLength(1);
    expect(full).toHaveLength(5);
    expect((await getClass(admin, d.nextFri, slotId))!.booked).toBe(capacity);
  });

  it("el admin agenda pruebas sin límite de cupo y las gestiona", async () => {
    const person = trialPayload();
    const created = await admin.post("/api/admin/trials", { ...person, classDate: d.nextThu, slotId, notes: "Viene con un amigo" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: "scheduled", source: "admin", notes: "Viene con un amigo" });
    expect((await getClass(admin, d.nextThu, slotId))!.booked).toBe(capacity + 1);

    const id = created.body.id;
    const listed = await admin.get(`/api/admin/trials?q=${person.document}&status=scheduled&when=upcoming`);
    expect(listed.body.items.map((t: { id: string }) => t.id)).toContain(id);

    const base = { ...person, classDate: d.nextThu, slotId, notes: null, status: "scheduled", attendance: null };
    const future = await admin.put(`/api/admin/trials/${id}`, { ...base, attendance: "present" });
    expect(future.status).toBe(409);
    expect(future.body.error.code).toBe("FUTURE_ATTENDANCE");

    const moved = await admin.put(`/api/admin/trials/${id}`, { ...base, classDate: d.nextMon });
    expect(moved.status).toBe(200);
    expect(moved.body.classDate).toBe(d.nextMon);

    const cancelled = await admin.put(`/api/admin/trials/${id}`, { ...base, classDate: d.nextMon, status: "cancelled" });
    expect(cancelled.body.status).toBe("cancelled");
    const mon = await getClass(admin, d.nextMon, slotId);
    expect(mon?.attendees.some((a) => a.id === id) ?? false).toBe(false);
    expect((await admin.get(`/api/admin/trials?q=${person.document}&status=cancelled`)).body.total).toBe(1);

    const client = await createClient(admin, { schedule: [1, 3, 5].map((weekday) => ({ weekday, slotId })) });
    clients.push(client.id);
    const dup = await admin.post("/api/admin/trials", { ...trialPayload(), email: client.email, classDate: d.nextThu, slotId });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("ALREADY_CLIENT");

    expect((await admin.delete(`/api/admin/trials/${id}`)).status).toBe(204);
    expect((await admin.delete(`/api/admin/trials/${id}`)).status).toBe(404);
  });

  it("marca la asistencia de una prueba pasada", async () => {
    const person = trialPayload();
    const past = await admin.post("/api/admin/trials", { ...person, classDate: d.lastTue, slotId, notes: null });
    expect(past.status).toBe(201);
    const mark = await admin.post("/api/admin/classes/attendance", {
      date: d.lastTue,
      slotId,
      trialId: past.body.id,
      status: "present",
    });
    expect(mark.status).toBe(200);
    expect((await admin.get(`/api/admin/trials?q=${person.document}&status=attended`)).body.total).toBe(1);
    await admin.delete(`/api/admin/trials/${past.body.id}`);
  });

  it("homologa una prueba a cliente: queda en clientes y puede iniciar sesión", async () => {
    const person = trialPayload();
    const trial = await admin.post("/api/admin/trials", { ...person, classDate: d.nextTue, slotId, notes: null });
    const res = await admin.post(`/api/admin/trials/${trial.body.id}/convert`, {
      fullName: person.fullName,
      document: person.document,
      phone: person.phone,
      email: person.email,
      plan: "daily",
      monthlyFee: 150000,
      startDate: d.nextMon,
      notes: null,
      schedule: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, slotId })),
    });
    expect(res.status).toBe(201);
    clients.push(res.body.clientId);

    const trialAfter = await admin.get(`/api/admin/trials/${trial.body.id}`);
    expect(trialAfter.body).toMatchObject({ status: "converted", convertedClientId: res.body.clientId });
    const client = await admin.get(`/api/admin/clients/${res.body.clientId}`);
    expect(client.body).toMatchObject({ plan: "daily", monthlyFee: 150000, isActive: true });
    expect(client.body.schedule).toHaveLength(5);

    const session = await login(person.email, person.document);
    expect((await session.get("/api/me/profile")).body.fullName).toBe(person.fullName);

    const twice = await admin.post(`/api/admin/trials/${trial.body.id}/convert`, {
      ...person,
      plan: "daily",
      monthlyFee: 150000,
      startDate: d.nextMon,
      notes: null,
      schedule: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, slotId })),
    });
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe("TRIAL_ALREADY_CONVERTED");
    expect((await session.get("/api/admin/trials")).status).toBe(403);
  });
});
