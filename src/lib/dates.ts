// Utilidades de fecha compartidas entre cliente y servidor.
//
// Convención: las fechas de clase viajan como texto ISO "YYYY-MM-DD" y las
// horas como "HH:MM". Todo se interpreta en America/Bogota (UTC-5 fijo, sin
// horario de verano), sin importar la zona horaria del navegador o servidor.
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const TIME_ZONE = "America/Bogota";
const BOGOTA_OFFSET_HOURS = 5;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const bogotaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Fecha de hoy en Colombia. */
export function todayISO(now: Date = new Date()): string {
  return bogotaDateFormatter.format(now);
}

/** Convierte "YYYY-MM-DD" en un Date local (medianoche) apto para date-fns. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Convierte un Date (componentes locales) en "YYYY-MM-DD". */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function diffDaysISO(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

/** Día ISO de la semana: 1 = lunes … 7 = domingo. */
export function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Lunes de la semana a la que pertenece la fecha. */
export function startOfWeekISO(iso: string): string {
  return addDaysISO(iso, 1 - isoWeekday(iso));
}

export function weekDatesISO(iso: string, days = 7): string[] {
  const monday = startOfWeekISO(iso);
  return Array.from({ length: days }, (_, i) => addDaysISO(monday, i));
}

export function startOfMonthISO(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonthISO(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${iso.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function isSameWeek(a: string, b: string): boolean {
  return startOfWeekISO(a) === startOfWeekISO(b);
}

/** Instante (UTC) en que empieza una clase: fecha + hora de Bogotá. */
export function classStartsAt(dateISO: string, time: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh + BOGOTA_OFFSET_HOURS, mm));
}

/** "06:00:00" → "06:00" */
export function toHHMM(time: string): string {
  return time.slice(0, 5);
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// ---------------------------------------------------------------------------
// Formato para la interfaz (español de Colombia)
// ---------------------------------------------------------------------------

/** "06:00" → "6:00 am", "15:30" → "3:30 pm" */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "6:00 – 7:00 am" o "11:00 am – 12:00 pm" */
export function formatTimeRange(start: string, end: string): string {
  const s = formatTime(start);
  const e = formatTime(end);
  const sSuffix = s.slice(-2);
  const eSuffix = e.slice(-2);
  return sSuffix === eSuffix ? `${s.slice(0, -3)} – ${e}` : `${s} – ${e}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Miércoles, 8 de octubre" (+ año si no es el actual) */
export function formatDateLong(iso: string, opts: { withYear?: boolean } = {}): string {
  const date = parseISODate(iso);
  const withYear = opts.withYear ?? iso.slice(0, 4) !== todayISO().slice(0, 4);
  return capitalize(format(date, withYear ? "EEEE, d 'de' MMMM 'de' yyyy" : "EEEE, d 'de' MMMM", { locale: es }));
}

/** "mié 8 oct" */
export function formatDateShort(iso: string): string {
  return format(parseISODate(iso), "EEE d MMM", { locale: es }).replace(/\./g, "");
}

/** "8 oct 2026" */
export function formatDateCompact(iso: string): string {
  return format(parseISODate(iso), "d MMM yyyy", { locale: es }).replace(/\./g, "");
}

/** "Octubre 2026" */
export function formatMonth(iso: string): string {
  return capitalize(format(parseISODate(iso), "MMMM yyyy", { locale: es }));
}

export function formatWeekRange(iso: string): string {
  const monday = startOfWeekISO(iso);
  const sunday = addDaysISO(monday, 6);
  const a = parseISODate(monday);
  const b = parseISODate(sunday);
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()} – ${format(b, "d 'de' MMMM", { locale: es })}`;
  }
  return `${format(a, "d MMM", { locale: es })} – ${format(b, "d MMM", { locale: es })}`.replace(/\./g, "");
}

/** "hoy", "mañana", "ayer" o null */
export function relativeDayLabel(iso: string, today: string = todayISO()): string | null {
  const diff = diffDaysISO(iso, today);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  return null;
}
