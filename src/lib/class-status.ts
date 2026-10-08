import { classStartsAt } from "./dates";

export type ClassTiming = "upcoming" | "live" | "done";

/** Estado temporal de una clase según la hora actual (Bogotá). */
export function classTiming(date: string, startTime: string, endTime: string, now = Date.now()): ClassTiming {
  const start = classStartsAt(date, startTime).getTime();
  const end = classStartsAt(date, endTime).getTime();
  if (now < start) return "upcoming";
  if (now < end) return "live";
  return "done";
}

/** "en 2 h", "en 25 min" */
export function timeUntil(date: string, startTime: string, now = Date.now()): string {
  const minutes = Math.round((classStartsAt(date, startTime).getTime() - now) / 60_000);
  if (minutes < 60) return `en ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `en ${hours} h`;
  const days = Math.round(hours / 24);
  return `en ${days} ${days === 1 ? "día" : "días"}`;
}
