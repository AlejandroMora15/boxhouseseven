export const APP_NAME = "Boxhouseseven";

export type Plan = "three_days" | "daily";

export const PLANS: Record<Plan, { label: string; short: string; daysPerWeek: number }> = {
  three_days: { label: "3 veces por semana", short: "3 días", daysPerWeek: 3 },
  daily: { label: "Todos los días", short: "Diario", daysPerWeek: 5 },
};

export const PLAN_OPTIONS: Plan[] = ["three_days", "daily"];

/** Días de entrenamiento habilitados para los planes (lunes a viernes). */
export const TRAINING_WEEKDAYS = [1, 2, 3, 4, 5] as const;

export const WEEKDAYS = [
  { iso: 1, letter: "L", short: "Lun", long: "Lunes" },
  { iso: 2, letter: "M", short: "Mar", long: "Martes" },
  { iso: 3, letter: "X", short: "Mié", long: "Miércoles" },
  { iso: 4, letter: "J", short: "Jue", long: "Jueves" },
  { iso: 5, letter: "V", short: "Vie", long: "Viernes" },
  { iso: 6, letter: "S", short: "Sáb", long: "Sábado" },
  { iso: 7, letter: "D", short: "Dom", long: "Domingo" },
] as const;

export function weekdayLabel(iso: number, variant: "letter" | "short" | "long" = "long"): string {
  return WEEKDAYS.find((d) => d.iso === iso)?.[variant] ?? "";
}

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

/** Lo que debe llevar una persona a su clase de prueba. */
export const TRIAL_CHECKLIST = ["Agua", "Toalla", "Ropa deportiva"] as const;
