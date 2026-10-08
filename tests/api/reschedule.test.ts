import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { addDaysISO } from "@/lib/dates";
import {
  adminDb,
  createClient,
  getClass,
  login,
  loginAdmin,
  refDates,
  Session,
  TEST_CLOSED_REASON,
} from "./helpers";

const slotId = inject("testSlotId");
const monWedFri = [1, 3, 5].map((weekday) => ({ weekday, slotId }));

describe("cliente: agenda personal y reagendamiento", () => {
  let admin: Session;
  let me: Session;
  let client: Awaited<ReturnType<typeof createClient>>;
  let capacity: number;
  const d = refDates();
  const others: string[] = [];
  const sql = adminDb();

  const move = (fromDate: string, toDate: string, toSlotId = slotId, fromSlotId = slotId) =>
    me.post("/api/me/reschedule", { fromDate, fromSlotId, toDate, toSlotId });
  const week = async (date: string) => (await me.get(`/api/me/agenda?date=${date}`)).body;

  beforeAll(async () => {
    admin = await loginAdmin();
    capacity = (await admin.get("/api/admin/settings")).body.maxPerClass;
    client = await createClient(admin, { fullName: "Reagenda Cliente", schedule: monWedFri });
    me = await login(client.email, client.document);
  });

  afterAll(async () => {
    for (const id of [client.id, ...others]) await admin.delete(`/api/admin/clients/${id}`);
    await sql.end();
  });

  it("ve su semana con sus clases y su plan", async () => {
    const agenda = await week(d.nextWed);
    expect(agenda.weekStart).toBe(d.nextMon);
    expect(agenda.plan).toBe("three_days");
    const mine = agenda.classes.filter((c: { slotId: number }) => c.slotId === slotId);
    expect(mine.map((c: { date: string }) => c.date)).toEqual([d.nextMon, d.nextWed, d.nextFri]);
    expect(mine.every((c: { canReschedule: boolean; origin: string }) => c.canReschedule && c.origin === "schedule")).toBe(
      true,
    );
  });

  it("las opciones de reagendamiento son de la misma semana y bloquean días con clase", async () => {
    const res = await me.get(`/api/me/reschedule-options?date=${d.nextMon}&slotId=${slotId}`);
    expect(res.status).toBe(200);
    const days = res.body.days as Array<{ date: string; blockedReason: string | null; options: any[] }>;
    expect(days.every((x) => x.date >= d.nextMon && x.date <= addDaysISO(d.nextMon, 6))).toBe(true);
    expect(days.find((x) => x.date === d.nextWed)!.blockedReason).toMatch(/Ya tienes/);
    expect(days.find((x) => x.date === d.nextFri)!.blockedReason).toMatch(/Ya tienes/);
    expect(days.find((x) => x.date === d.nextTue)!.blockedReason).toBeNull();
    const current = days.find((x) => x.date === d.nextMon)!.options.find((o) => o.slotId === slotId);
    expect(current.status).toBe("current");
    // Privacidad: solo cupos, nunca nombres.
    expect(JSON.stringify(res.body)).not.toMatch(/fullName|@/);
  });

  it("reagenda dentro de la semana y conserva el origen al moverla de nuevo", async () => {
    expect((await move(d.nextMon, d.nextTue)).status).toBe(200);
    let agenda = await week(d.nextMon);
    expect(agenda.classes.some((c: { date: string }) => c.date === d.nextMon)).toBe(false);
    const tue = agenda.classes.find((c: { date: string }) => c.date === d.nextTue);
    expect(tue).toMatchObject({ origin: "reschedule", movedFrom: { date: d.nextMon, startTime: "22:00" } });

    // El admin lo ve como reagendado en la nueva clase.
    const adminView = await getClass(admin, d.nextTue, slotId);
    expect(adminView!.attendees.find((a) => a.id === client.id)).toMatchObject({
      origin: "reschedule",
      movedFrom: { date: d.nextMon },
    });

    expect((await move(d.nextTue, d.nextThu)).status).toBe(200);
    agenda = await week(d.nextMon);
    expect(agenda.classes.find((c: { date: string }) => c.date === d.nextThu).movedFrom.date).toBe(d.nextMon);
  });

  it("aplica las reglas: misma semana, un día con clase, misma clase, inexistente o pasada", async () => {
    const otherDay = await move(d.nextThu, d.nextWed);
    expect(otherDay.status).toBe(409);
    expect(otherDay.body.error.code).toBe("ALREADY_HAS_CLASS_THAT_DAY");

    const otherWeek = await move(d.nextThu, d.nextNextMon);
    expect(otherWeek.status).toBe(422);
    expect(otherWeek.body.error.code).toBe("DIFFERENT_WEEK");

    const same = await move(d.nextThu, d.nextThu);
    expect(same.body.error.code).toBe("SAME_CLASS");

    const missing = await me.post("/api/me/reschedule", {
      fromDate: d.nextTue,
      fromSlotId: slotId,
      toDate: d.nextSat,
      toSlotId: slotId,
    });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("CLASS_NOT_FOUND");

    const past = await move(d.lastMon, d.lastTue);
    expect(past.status).toBe(409);
    expect(past.body.error.code).toBe("FROM_TOO_LATE");

    const pastOptions = await me.get(`/api/me/reschedule-options?date=${d.lastMon}&slotId=${slotId}`);
    expect(pastOptions.status).toBe(409);
  });

  it("solo reagenda si hay cupo en la clase destino", async () => {
    const fillers = await Promise.all(
      Array.from({ length: capacity }, (_, i) =>
        createClient(admin, {
          fullName: `Lleno Martes ${"abcdefghijklmnop"[i]}`,
          schedule: [2, 4, 5].map((weekday) => ({ weekday, slotId })),
          startDate: d.nextTue,
        }),
      ),
    );
    others.push(...fillers.map((f) => f.id));
    expect((await getClass(admin, d.nextTue, slotId))!.booked).toBeGreaterThanOrEqual(capacity);

    const full = await move(d.nextThu, d.nextTue);
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe("CLASS_FULL");

    const options = await me.get(`/api/me/reschedule-options?date=${d.nextThu}&slotId=${slotId}`);
    const tue = options.body.days.find((x: { date: string }) => x.date === d.nextTue);
    expect(tue.options.find((o: { slotId: number }) => o.slotId === slotId).status).toBe("full");
  });

  it("devolver la clase a su día original restaura el horario base", async () => {
    expect((await move(d.nextThu, d.nextMon)).status).toBe(200);
    const agenda = await week(d.nextMon);
    expect(agenda.classes.find((c: { date: string }) => c.date === d.nextMon).origin).toBe("schedule");
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from public.schedule_exceptions
      where client_id = ${client.id}::uuid and class_date between ${d.nextMon}::date and ${addDaysISO(d.nextMon, 6)}::date
    `;
    expect(count).toBe(0);
  });

  it("un día cerrado permite mover la clase a otro día, pero no hacia él", async () => {
    await admin.post("/api/admin/closed-days", { days: [{ day: d.nextWed, reason: TEST_CLOSED_REASON }] });
    try {
      const agenda = await week(d.nextWed);
      const wed = agenda.classes.find((c: { date: string }) => c.date === d.nextWed);
      expect(wed).toMatchObject({ closedReason: TEST_CLOSED_REASON, canReschedule: true });

      const toClosed = await move(d.nextMon, d.nextWed);
      expect(toClosed.status).toBe(409);
      expect(["DAY_CLOSED", "ALREADY_HAS_CLASS_THAT_DAY"]).toContain(toClosed.body.error.code);

      // (martes a viernes quedaron llenos en la prueba anterior: se usa el sábado)
      const fromClosed = await move(d.nextWed, d.nextSat);
      expect(fromClosed.status).toBe(200);
      expect((await move(d.nextSat, d.nextWed)).body.error.code).toBe("DAY_CLOSED");
    } finally {
      await admin.delete(`/api/admin/closed-days/${d.nextWed}`);
    }
  });

  it("cambiar el horario base desde el admin reinicia los reagendamientos pendientes", async () => {
    const detail = (await admin.get(`/api/admin/clients/${client.id}`)).body;
    const res = await admin.put(`/api/admin/clients/${client.id}`, {
      fullName: detail.fullName,
      document: detail.document,
      phone: detail.phone,
      email: detail.email,
      plan: "three_days",
      monthlyFee: detail.monthlyFee,
      startDate: detail.startDate,
      isActive: true,
      notes: null,
      schedule: [2, 4, 5].map((weekday) => ({ weekday, slotId })),
    });
    expect(res.status).toBe(200);
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from public.schedule_exceptions
      where client_id = ${client.id}::uuid and source = 'reschedule' and class_date >= ${d.today}::date
    `;
    expect(count).toBe(0);
  });

  it("su perfil e historial son de solo lectura y no muestran a otros", async () => {
    const profile = await me.get("/api/me/profile");
    expect(profile.status).toBe(200);
    expect(profile.body).toMatchObject({ email: client.email, document: client.document, plan: "three_days" });
    expect(profile.body.schedule).toHaveLength(3);
    const history = await me.get(`/api/me/history?month=${d.lastWed}`);
    expect(history.status).toBe(200);
    // No existen endpoints de escritura de perfil para el cliente.
    expect((await me.put("/api/me/profile", { fullName: "Hack" })).status).toBe(405);
    expect((await me.put(`/api/admin/clients/${client.id}`, {})).status).toBe(403);
  });

  it("un cliente inactivo ya no puede reagendar", async () => {
    await admin.patch(`/api/admin/clients/${client.id}/status`, { isActive: false });
    const res = await move(d.nextTue, d.nextWed);
    expect(res.status).toBe(401);
  });
});
