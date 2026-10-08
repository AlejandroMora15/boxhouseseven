// Festivos de Colombia (Ley 51 de 1983, "Ley Emiliani"): algunos se trasladan
// al lunes siguiente y otros dependen de la fecha de Pascua.
import { addDaysISO, isoWeekday } from "./dates";

export interface Holiday {
  date: string;
  name: string;
}

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Traslada la fecha al lunes siguiente (si no cae lunes). */
function toMonday(date: string): string {
  const w = isoWeekday(date);
  return w === 1 ? date : addDaysISO(date, 8 - w);
}

export function colombianHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const list: Holiday[] = [
    { date: iso(year, 1, 1), name: "Año Nuevo" },
    { date: toMonday(iso(year, 1, 6)), name: "Día de los Reyes Magos" },
    { date: toMonday(iso(year, 3, 19)), name: "Día de San José" },
    { date: addDaysISO(easter, -3), name: "Jueves Santo" },
    { date: addDaysISO(easter, -2), name: "Viernes Santo" },
    { date: iso(year, 5, 1), name: "Día del Trabajo" },
    { date: toMonday(addDaysISO(easter, 39)), name: "Ascensión del Señor" },
    { date: toMonday(addDaysISO(easter, 60)), name: "Corpus Christi" },
    { date: toMonday(addDaysISO(easter, 68)), name: "Sagrado Corazón" },
    { date: toMonday(iso(year, 6, 29)), name: "San Pedro y San Pablo" },
    { date: iso(year, 7, 20), name: "Día de la Independencia" },
    { date: iso(year, 8, 7), name: "Batalla de Boyacá" },
    { date: toMonday(iso(year, 8, 15)), name: "La Asunción de la Virgen" },
    { date: toMonday(iso(year, 10, 12)), name: "Día de la Raza" },
    { date: toMonday(iso(year, 11, 1)), name: "Todos los Santos" },
    { date: toMonday(iso(year, 11, 11)), name: "Independencia de Cartagena" },
    { date: iso(year, 12, 8), name: "Inmaculada Concepción" },
    { date: iso(year, 12, 25), name: "Navidad" },
  ];
  // Dos festivos pueden caer el mismo lunes (p. ej. 30 de junio de 2025).
  const byDate = new Map<string, string[]>();
  for (const h of list) byDate.set(h.date, [...(byDate.get(h.date) ?? []), h.name]);
  return [...byDate]
    .map(([date, names]) => ({ date, name: names.join(" / ") }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
