// Claves de caché de TanStack Query, centralizadas para invalidar con precisión.
export const qk = {
  agenda: ["agenda"] as const,
  agendaDay: (date: string) => ["agenda", "day", date] as const,
  agendaWeek: (weekStart: string) => ["agenda", "week", weekStart] as const,

  clients: ["clients"] as const,
  clientList: (query: object) => ["clients", "list", query] as const,
  client: (id: string) => ["clients", "detail", id] as const,
  clientHistory: (id: string, month: string) => ["clients", "history", id, month] as const,
  clientSearch: (q: string) => ["clients", "search", q] as const,

  trials: ["trials"] as const,
  trialList: (query: object) => ["trials", "list", query] as const,

  plans: ["plans"] as const,
  planRange: (from: string, to: string) => ["plans", from, to] as const,

  settings: ["settings"] as const,
  slots: ["slots"] as const,
  closedDays: ["closed-days"] as const,
  closedDayRange: (from: string, to: string) => ["closed-days", from, to] as const,

  me: ["me"] as const,
  myAgenda: (weekStart: string) => ["me", "agenda", weekStart] as const,
  myRescheduleOptions: (date: string, slotId: number) => ["me", "reschedule", date, slotId] as const,
  myProfile: ["me", "profile"] as const,
  myHistory: (month: string) => ["me", "history", month] as const,

  publicAvailability: ["public", "availability"] as const,
  publicInfo: ["public", "info"] as const,
};
