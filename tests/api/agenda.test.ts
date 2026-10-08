import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { addDaysISO } from "@/lib/dates";
import {
  createClient,
  getClass,
  loginAdmin,
  refDates,
  Session,
  TEST_CLOSED_REASON,
  TEST_PLAN_DATE,
} from "./helpers";

const slotId = inject("testSlotId");
const monWedFri = [1, 3, 5].map((weekday) => ({ weekday, slotId }));
const tueThu = (other: number) => [
  { weekday: 2, slotId },
  { weekday: 4, slotId },
  { weekday: other, slotId },
];

describe("agenda del admin: asistentes, cupos y asistencia", () => {
  let admin: Session;
  let capacity: number;
  const d = refDates();
  const ids: Record<string, string> = {};
  const extra: string[] = [];

  beforeAll(async () => {
    admin = await loginAdmin();
    capacity = (await admin.get("/api/admin/settings")).body.maxPerClass;
    const [a, b, inactive, future, e] = await Promise.all([
      createClient(admin, { fullName: "Agenda Alfa", schedule: monWedFri }),
      createClient(admin, { fullName: "Agenda Beta", schedule: monWedFri }),
      createClient(admin, { fullName: "Agenda Inactivo", schedule: monWedFri, isActive: false }),
      createClient(admin, { fullName: "Agenda Futuro", schedule: monWedFri, startDate: addDaysISO(d.nextWed, 1) }),
      createClient(admin, { fullName: "Agenda Extra", schedule: tueThu(1) }),
    ]);
    Object.assign(ids, { a: a.id, b: b.id, inactive: inactive.id, future: future.id, e: e.id });
  });

  afterAll(async () => {
    for (const id of [...Object.values(ids), ...extra]) await admin.delete(`/api/admin/clients/${id}`);
  });

  it("calcula los asistentes según el horario: excluye inactivos y clientes que aún no inician", async () => {
    const klass = await getClass(admin, d.nextWed, slotId);
    expect(klass).toBeDefined();
    const names = klass!.attendees.map((a) => a.fullName).sort();
    expect(names).toEqual(["Agenda Alfa", "Agenda Beta"]);
    expect(klass!.booked).toBe(2);
    expect(klass!.attendees.every((a) => a.origin === "schedule" && a.type === "client")).toBe(true);
  });

  it("la vista semanal muestra la ocupación por día", async () => {
    const week = await admin.get(`/api/admin/agenda/week?date=${d.nextWed}`);
    expect(week.status).toBe(200);
    expect(week.body.weekStart).toBe(d.nextMon);
    const wed = week.body.days.find((x: { date: string }) => x.date === d.nextWed);
    expect(wed.classes.find((c: { slotId: number }) => c.slotId === slotId).booked).toBe(2);
    // Sábado/domingo aparecen porque la franja de prueba aplica todos los días.
    expect(week.body.days.length).toBeGreaterThanOrEqual(5);
  });

  it("el admin agrega y quita asistentes de una clase puntual", async () => {
    const add = await admin.post("/api/admin/classes/add", { date: d.nextWed, slotId, clientId: ids.e, markPresent: false });
    expect(add.status).toBe(200);
    let klass = await getClass(admin, d.nextWed, slotId);
    expect(klass!.booked).toBe(3);
    expect(klass!.attendees.find((a) => a.id === ids.e).origin).toBe("admin");

    const again = await admin.post("/api/admin/classes/add", { date: d.nextWed, slotId, clientId: ids.a, markPresent: false });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ALREADY_IN_CLASS");

    // Quitar a alguien de su clase habitual solo afecta esa fecha.
    expect((await admin.post("/api/admin/classes/remove", { date: d.nextWed, slotId, clientId: ids.a })).status).toBe(200);
    klass = await getClass(admin, d.nextWed, slotId);
    expect(klass!.attendees.some((a) => a.id === ids.a)).toBe(false);
    expect((await getClass(admin, d.nextMon, slotId))!.attendees.some((a) => a.id === ids.a)).toBe(true);

    // Volver a agregarlo restaura su clase habitual (sin duplicados).
    await admin.post("/api/admin/classes/add", { date: d.nextWed, slotId, clientId: ids.a, markPresent: false });
    klass = await getClass(admin, d.nextWed, slotId);
    expect(klass!.attendees.filter((a) => a.id === ids.a)).toHaveLength(1);
    expect(klass!.attendees.find((a) => a.id === ids.a).origin).toBe("schedule");

    await admin.post("/api/admin/classes/remove", { date: d.nextWed, slotId, clientId: ids.e });
    expect((await getClass(admin, d.nextWed, slotId))!.booked).toBe(2);

    const notIn = await admin.post("/api/admin/classes/remove", { date: d.nextWed, slotId, clientId: ids.e });
    expect(notIn.status).toBe(409);
    expect(notIn.body.error.code).toBe("NOT_IN_CLASS");
  });

  it("desde la agenda el admin puede superar el cupo máximo", async () => {
    const more = await Promise.all(
      Array.from({ length: capacity }, (_, i) => createClient(admin, { fullName: `Agenda Lleno ${"abcdefghijklmnop"[i]}`, schedule: tueThu(5) })),
    );
    extra.push(...more.map((m) => m.id));
    for (const m of more) {
      expect(
        (await admin.post("/api/admin/classes/add", { date: d.nextWed, slotId, clientId: m.id, markPresent: false })).status,
      ).toBe(200);
    }
    const klass = await getClass(admin, d.nextWed, slotId);
    expect(klass!.booked).toBe(capacity + 2);
    expect(klass!.booked).toBeGreaterThan(klass!.capacity);
  });

  it("no permite marcar asistencia de clases futuras", async () => {
    const res = await admin.post("/api/admin/classes/attendance", {
      date: d.nextWed,
      slotId,
      clientId: ids.a,
      status: "present",
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("FUTURE_ATTENDANCE");
  });

  it("marca, corrige y limpia la asistencia de clases pasadas", async () => {
    const mark = (clientId: string, status: string | null) =>
      admin.post("/api/admin/classes/attendance", { date: d.lastWed, slotId, clientId, status });

    expect((await mark(ids.a, "present")).status).toBe(200);
    expect((await mark(ids.b, "absent")).status).toBe(200);
    let klass = await getClass(admin, d.lastWed, slotId);
    expect(klass!.attendees.find((a) => a.id === ids.a).attendance).toBe("present");
    expect(klass!.attendees.find((a) => a.id === ids.b).attendance).toBe("absent");

    const history = await admin.get(`/api/admin/clients/${ids.a}/history?month=${d.lastWed}`);
    expect(history.body.items.some((i: { date: string; status: string }) => i.date === d.lastWed && i.status === "present")).toBe(true);
    expect(history.body.summary.present).toBeGreaterThanOrEqual(1);

    // Quien no está en la clase no puede tener asistencia.
    const notIn = await mark(ids.e, "present");
    expect(notIn.status).toBe(409);

    expect((await mark(ids.a, null)).status).toBe(200);
    klass = await getClass(admin, d.lastWed, slotId);
    expect(klass!.attendees.find((a) => a.id === ids.a).attendance).toBeNull();

    const all = await admin.post("/api/admin/classes/attendance-all", { date: d.lastWed, slotId, status: "present" });
    expect(all.status).toBe(200);
    expect(all.body.updated).toBeGreaterThanOrEqual(2);
    klass = await getClass(admin, d.lastWed, slotId);
    expect(klass!.attendees.filter((a) => [ids.a, ids.b].includes(a.id)).every((a) => a.attendance === "present")).toBe(true);
  });

  it("registra a un cliente inactivo que asistió (solo marcándolo como asistente)", async () => {
    const withoutMark = await admin.post("/api/admin/classes/add", {
      date: d.lastWed,
      slotId,
      clientId: ids.inactive,
      markPresent: false,
    });
    expect(withoutMark.status).toBe(409);
    expect(withoutMark.body.error.code).toBe("CLIENT_INACTIVE");

    const withMark = await admin.post("/api/admin/classes/add", {
      date: d.lastWed,
      slotId,
      clientId: ids.inactive,
      markPresent: true,
    });
    expect(withMark.status).toBe(200);
    const klass = await getClass(admin, d.lastWed, slotId);
    const entry = klass!.attendees.find((a) => a.id === ids.inactive);
    expect(entry).toMatchObject({ attendance: "present", isActive: false });
  });

  it("días cerrados: la agenda lo indica y se puede reabrir", async () => {
    const add = await admin.post("/api/admin/closed-days", { days: [{ day: d.nextWed, reason: TEST_CLOSED_REASON }] });
    expect(add.status).toBe(201);
    expect(add.body.affected).toBeGreaterThanOrEqual(2);
    const day = await admin.get(`/api/admin/agenda/day?date=${d.nextWed}`);
    expect(day.body.closedReason).toBe(TEST_CLOSED_REASON);
    expect((await admin.delete(`/api/admin/closed-days/${d.nextWed}`)).status).toBe(204);
    expect((await admin.get(`/api/admin/agenda/day?date=${d.nextWed}`)).body.closedReason).toBeNull();
  });

  it("planificación por día: guardar, listar y borrar", async () => {
    const save = await admin.put(`/api/admin/plans/${TEST_PLAN_DATE}`, { content: "  Sombra 3x3, saco 6x2  " });
    expect(save.status).toBe(200);
    expect(save.body.plan.content).toBe("Sombra 3x3, saco 6x2");
    const list = await admin.get(`/api/admin/plans?from=${TEST_PLAN_DATE}&to=${TEST_PLAN_DATE}`);
    expect(list.body.items).toHaveLength(1);
    expect((await admin.get(`/api/admin/agenda/day?date=${TEST_PLAN_DATE}`)).body.plan.content).toBe("Sombra 3x3, saco 6x2");
    const clear = await admin.put(`/api/admin/plans/${TEST_PLAN_DATE}`, { content: "   " });
    expect(clear.body.plan).toBeNull();
    expect((await admin.get(`/api/admin/plans?from=${TEST_PLAN_DATE}&to=${TEST_PLAN_DATE}`)).body.items).toHaveLength(0);
    expect((await admin.put(`/api/admin/plans/2026-02-30`, { content: "x" })).status).toBe(422);
    expect((await admin.get(`/api/admin/plans?from=2026-01-01&to=2026-12-31`)).status).toBe(422);
  });

  it("valida la fecha de la agenda", async () => {
    expect((await admin.get("/api/admin/agenda/day?date=ayer")).status).toBe(422);
    expect((await admin.get("/api/admin/agenda/day")).status).toBe(422);
  });
});
