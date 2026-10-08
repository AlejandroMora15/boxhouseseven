import { describe, expect, it } from "vitest";
import {
  clientInputSchema,
  loginSchema,
  rescheduleSchema,
  settingsSchema,
  slotInputSchema,
  trialBookingSchema,
  trialPersonSchema,
} from "@/lib/schemas";

const base = {
  fullName: "  Ana   María  López ",
  document: "1.094.887.123",
  phone: "300 123 4567",
  email: " Ana.Lopez@Correo.COM ",
  plan: "three_days" as const,
  monthlyFee: "130000",
  startDate: "2026-10-01",
  isActive: true,
  notes: "",
  schedule: [
    { weekday: 1, slotId: 1 },
    { weekday: 3, slotId: 1 },
    { weekday: 5, slotId: 2 },
  ],
};

describe("cliente", () => {
  it("normaliza nombre, documento, celular y correo", () => {
    const r = clientInputSchema.parse(base);
    expect(r.fullName).toBe("Ana María López");
    expect(r.document).toBe("1094887123");
    expect(r.phone).toBe("3001234567");
    expect(r.email).toBe("ana.lopez@correo.com");
    expect(r.monthlyFee).toBe(130000);
    expect(r.notes).toBeNull();
  });

  it("el plan de 3 días exige exactamente 3 días", () => {
    const r = clientInputSchema.safeParse({ ...base, schedule: base.schedule.slice(0, 2) });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/exactamente 3/);
  });

  it("el plan diario exige de lunes a viernes", () => {
    const r = clientInputSchema.safeParse({ ...base, plan: "daily" });
    expect(r.success).toBe(false);
    const ok = clientInputSchema.safeParse({
      ...base,
      plan: "daily",
      schedule: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, slotId: 1 })),
    });
    expect(ok.success).toBe(true);
  });

  it("rechaza fines de semana y días repetidos", () => {
    expect(
      clientInputSchema.safeParse({
        ...base,
        schedule: [
          { weekday: 1, slotId: 1 },
          { weekday: 3, slotId: 1 },
          { weekday: 6, slotId: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      clientInputSchema.safeParse({
        ...base,
        schedule: [
          { weekday: 1, slotId: 1 },
          { weekday: 1, slotId: 2 },
          { weekday: 3, slotId: 1 },
        ],
      }).success,
    ).toBe(false);
  });

  it("exige horario seleccionado y valores válidos", () => {
    expect(clientInputSchema.safeParse({ ...base, schedule: [{ weekday: 1, slotId: 0 }, ...base.schedule.slice(1)] }).success).toBe(false);
    expect(clientInputSchema.safeParse({ ...base, monthlyFee: "-5" }).success).toBe(false);
    expect(clientInputSchema.safeParse({ ...base, phone: "12345" }).success).toBe(false);
    expect(clientInputSchema.safeParse({ ...base, email: "no-es-correo" }).success).toBe(false);
    expect(clientInputSchema.safeParse({ ...base, fullName: "A1" }).success).toBe(false);
    expect(clientInputSchema.safeParse({ ...base, startDate: "2026-02-31" }).success).toBe(false);
  });
});

describe("clase de prueba", () => {
  const person = { fullName: "Luis Pérez", document: "1088456321", phone: "3127778899", email: "luis@correo.com" };

  it("acepta datos válidos", () => {
    expect(trialPersonSchema.safeParse(person).success).toBe(true);
    expect(trialBookingSchema.safeParse({ ...person, classDate: "2026-10-12", slotId: 3 }).success).toBe(true);
  });

  it("rechaza si el campo trampa (bots) viene lleno", () => {
    expect(trialPersonSchema.safeParse({ ...person, website: "http://spam" }).success).toBe(false);
  });

  it("acepta celulares internacionales con +", () => {
    expect(trialPersonSchema.safeParse({ ...person, phone: "+1 305 555 1234" }).success).toBe(true);
  });
});

describe("otros esquemas", () => {
  it("login normaliza el correo", () => {
    expect(loginSchema.parse({ email: " ADMIN@X.CO ", password: "1" }).email).toBe("admin@x.co");
  });

  it("franja: la hora de fin debe ser posterior y los días se ordenan", () => {
    expect(slotInputSchema.safeParse({ startTime: "07:00", endTime: "06:00", weekdays: [1] }).success).toBe(false);
    expect(slotInputSchema.parse({ startTime: "06:00:00", endTime: "07:00", weekdays: [5, 1, 1] })).toEqual({
      startTime: "06:00",
      endTime: "07:00",
      weekdays: [1, 5],
    });
    expect(slotInputSchema.safeParse({ startTime: "06:00", endTime: "07:00", weekdays: [] }).success).toBe(false);
  });

  it("configuración: límites de cupo y WhatsApp", () => {
    const ok = {
      maxPerClass: "7",
      priceThreeDays: 130000,
      priceDaily: 150000,
      bookingCutoffMinutes: 60,
      trialWindowDays: 14,
      whatsappPhone: "",
      address: "",
    };
    expect(settingsSchema.parse(ok)).toMatchObject({ maxPerClass: 7, whatsappPhone: null, address: null });
    expect(settingsSchema.safeParse({ ...ok, maxPerClass: 0 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...ok, whatsappPhone: "abc" }).success).toBe(false);
  });

  it("reagendar exige fechas válidas", () => {
    expect(rescheduleSchema.safeParse({ fromDate: "2026-10-12", fromSlotId: 1, toDate: "x", toSlotId: 2 }).success).toBe(
      false,
    );
  });
});
