import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  addMonthsISO,
  classStartsAt,
  diffDaysISO,
  endOfMonthISO,
  formatTime,
  formatTimeRange,
  isISODate,
  isoWeekday,
  isSameWeek,
  relativeDayLabel,
  startOfWeekISO,
  todayISO,
  weekDatesISO,
} from "@/lib/dates";
import { classTiming, timeUntil } from "@/lib/class-status";

describe("zona horaria de Bogotá", () => {
  it("usa la fecha de Colombia aunque en UTC ya sea el día siguiente", () => {
    // 2026-10-09 03:30 UTC = 2026-10-08 22:30 en Bogotá
    expect(todayISO(new Date("2026-10-09T03:30:00Z"))).toBe("2026-10-08");
    expect(todayISO(new Date("2026-10-09T05:00:00Z"))).toBe("2026-10-09");
  });

  it("calcula el instante UTC de inicio de una clase (UTC-5)", () => {
    expect(classStartsAt("2026-10-08", "06:00").toISOString()).toBe("2026-10-08T11:00:00.000Z");
    expect(classStartsAt("2026-10-08", "19:00").toISOString()).toBe("2026-10-09T00:00:00.000Z");
  });
});

describe("aritmética de fechas ISO", () => {
  it("suma días cruzando meses y años", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("calcula diferencias de días", () => {
    expect(diffDaysISO("2026-10-12", "2026-10-08")).toBe(4);
    expect(diffDaysISO("2026-10-08", "2026-10-12")).toBe(-4);
  });

  it("día ISO de la semana (1 = lunes, 7 = domingo)", () => {
    expect(isoWeekday("2026-10-05")).toBe(1);
    expect(isoWeekday("2026-10-08")).toBe(4);
    expect(isoWeekday("2026-10-11")).toBe(7);
  });

  it("inicio de semana es el lunes", () => {
    expect(startOfWeekISO("2026-10-08")).toBe("2026-10-05");
    expect(startOfWeekISO("2026-10-11")).toBe("2026-10-05");
    expect(startOfWeekISO("2026-10-12")).toBe("2026-10-12");
    expect(weekDatesISO("2026-10-08", 5)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
  });

  it("misma semana (lunes a domingo)", () => {
    expect(isSameWeek("2026-10-05", "2026-10-11")).toBe(true);
    expect(isSameWeek("2026-10-11", "2026-10-12")).toBe(false);
  });

  it("suma meses ajustando fin de mes", () => {
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2026-10-08", 1)).toBe("2026-11-08");
    expect(addMonthsISO("2026-12-15", 1)).toBe("2027-01-15");
    expect(endOfMonthISO("2028-02-10")).toBe("2028-02-29");
  });

  it("valida fechas ISO reales", () => {
    expect(isISODate("2026-10-08")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("08/10/2026")).toBe(false);
    expect(isISODate(null)).toBe(false);
  });

  it("etiquetas relativas", () => {
    expect(relativeDayLabel("2026-10-08", "2026-10-08")).toBe("Hoy");
    expect(relativeDayLabel("2026-10-09", "2026-10-08")).toBe("Mañana");
    expect(relativeDayLabel("2026-10-07", "2026-10-08")).toBe("Ayer");
    expect(relativeDayLabel("2026-10-20", "2026-10-08")).toBeNull();
  });
});

describe("formato de horas", () => {
  it("formato de 12 horas", () => {
    expect(formatTime("06:00")).toBe("6:00 am");
    expect(formatTime("12:00")).toBe("12:00 pm");
    expect(formatTime("15:30:00")).toBe("3:30 pm");
    expect(formatTime("00:15")).toBe("12:15 am");
  });

  it("rangos comparten sufijo cuando aplica", () => {
    expect(formatTimeRange("06:00", "07:00")).toBe("6:00 – 7:00 am");
    expect(formatTimeRange("11:00", "12:00")).toBe("11:00 am – 12:00 pm");
  });
});

describe("estado temporal de una clase", () => {
  const start = classStartsAt("2026-10-08", "06:00").getTime();
  it("próxima, en curso y finalizada", () => {
    expect(classTiming("2026-10-08", "06:00", "07:00", start - 1)).toBe("upcoming");
    expect(classTiming("2026-10-08", "06:00", "07:00", start + 30 * 60_000)).toBe("live");
    expect(classTiming("2026-10-08", "06:00", "07:00", start + 60 * 60_000)).toBe("done");
  });

  it("texto de tiempo restante", () => {
    expect(timeUntil("2026-10-08", "06:00", start - 25 * 60_000)).toBe("en 25 min");
    expect(timeUntil("2026-10-08", "06:00", start - 3 * 3600_000)).toBe("en 3 h");
    expect(timeUntil("2026-10-08", "06:00", start - 48 * 3600_000)).toBe("en 2 días");
  });
});
