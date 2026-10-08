import { describe, expect, it } from "vitest";
import { colombianHolidays, easterSunday } from "@/lib/holidays-co";

describe("festivos de Colombia", () => {
  it("calcula el domingo de Pascua", () => {
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("coincide con el calendario oficial de 2026", () => {
    expect(colombianHolidays(2026).map((h) => h.date)).toEqual([
      "2026-01-01",
      "2026-01-12",
      "2026-03-23",
      "2026-04-02",
      "2026-04-03",
      "2026-05-01",
      "2026-05-18",
      "2026-06-08",
      "2026-06-15",
      "2026-06-29",
      "2026-07-20",
      "2026-08-07",
      "2026-08-17",
      "2026-10-12",
      "2026-11-02",
      "2026-11-16",
      "2026-12-08",
      "2026-12-25",
    ]);
  });

  it("coincide con el calendario oficial de 2025", () => {
    expect(colombianHolidays(2025).map((h) => h.date)).toEqual([
      "2025-01-01",
      "2025-01-06",
      "2025-03-24",
      "2025-04-17",
      "2025-04-18",
      "2025-05-01",
      "2025-06-02",
      "2025-06-23",
      "2025-06-30",
      "2025-07-20",
      "2025-08-07",
      "2025-08-18",
      "2025-10-13",
      "2025-11-03",
      "2025-11-17",
      "2025-12-08",
      "2025-12-25",
    ]);
  });

  it("une festivos que caen el mismo día", () => {
    const june30 = colombianHolidays(2025).find((h) => h.date === "2025-06-30");
    expect(june30?.name).toContain("Sagrado Corazón");
    expect(june30?.name).toContain("San Pedro y San Pablo");
  });

  it("los festivos trasladables siempre caen lunes", () => {
    const movable = ["Reyes", "San José", "Ascensión", "Corpus", "Sagrado", "San Pedro", "Asunción", "Raza", "Santos", "Cartagena"];
    for (const year of [2026, 2027, 2028, 2029]) {
      for (const h of colombianHolidays(year).filter((x) => movable.some((m) => x.name.includes(m)))) {
        const [y, m, d] = h.date.split("-").map(Number);
        expect(new Date(Date.UTC(y, m - 1, d)).getUTCDay(), `${h.name} ${h.date}`).toBe(1);
      }
    }
  });
});
