// Servicios del portal del cliente. Siempre reciben el id del cliente desde
// la sesión, nunca desde la petición.
import { PLANS, type Plan } from "@/lib/constants";
import { addDaysISO, isSameWeek, startOfWeekISO } from "@/lib/dates";
import type { RescheduleInput } from "@/lib/schemas";
import type { ClientAgendaWeek, ClientProfile, RescheduleOptions, ScheduleEntry } from "@/lib/types";
import { sql } from "../db";
import { AppError } from "../errors";
import { getGrid } from "./agenda";
import { getClientClasses } from "./client-classes";
import { getSettings } from "./settings";

async function getPlan(clientId: string): Promise<Plan> {
  const [row] = await sql<{ plan: Plan }[]>`select plan from public.clients where user_id = ${clientId}::uuid`;
  if (!row) throw new AppError("CLIENT_NOT_FOUND");
  return row.plan;
}

export async function getMyAgenda(clientId: string, date: string): Promise<ClientAgendaWeek> {
  const weekStart = startOfWeekISO(date);
  const settings = await getSettings();
  const [plan, classes] = await Promise.all([
    getPlan(clientId),
    getClientClasses(clientId, weekStart, addDaysISO(weekStart, 6), settings.bookingCutoffMinutes),
  ]);
  return {
    weekStart,
    plan,
    daysPerWeek: PLANS[plan].daysPerWeek,
    classes,
    cutoffMinutes: settings.bookingCutoffMinutes,
  };
}

/** Horarios de la misma semana a los que el cliente puede mover una clase. */
export async function getRescheduleOptions(
  clientId: string,
  fromDate: string,
  fromSlotId: number,
): Promise<RescheduleOptions> {
  const weekStart = startOfWeekISO(fromDate);
  const weekEnd = addDaysISO(weekStart, 6);
  const settings = await getSettings();
  const [classes, grid] = await Promise.all([
    getClientClasses(clientId, weekStart, weekEnd, settings.bookingCutoffMinutes),
    getGrid(weekStart, weekEnd),
  ]);

  const from = classes.find((c) => c.date === fromDate && c.slotId === fromSlotId);
  if (!from) throw new AppError("CLASS_NOT_FOUND");
  if (!from.canReschedule) throw new AppError(from.attendance ? "ATTENDANCE_ALREADY_MARKED" : "FROM_TOO_LATE");

  const limit = Date.now() + settings.bookingCutoffMinutes * 60_000;
  const busyDays = new Set(
    classes
      .filter((c) => c.origin !== "attendance" && !(c.date === fromDate && c.slotId === fromSlotId))
      .map((c) => c.date),
  );

  const dates = [...new Set(grid.map((g) => g.date))];
  return {
    from: { date: from.date, slotId: from.slotId, startTime: from.startTime, endTime: from.endTime },
    days: dates.map((date) => {
      const dayClasses = grid.filter((g) => g.date === date);
      const closedReason = dayClasses[0]?.closedReason ?? null;
      return {
        date,
        closedReason,
        blockedReason: closedReason
          ? `Cerrado: ${closedReason}`
          : busyDays.has(date)
            ? "Ya tienes una clase este día"
            : null,
        options: dayClasses.map((g) => {
          const available = Math.max(0, g.capacity - g.booked);
          const isCurrent = g.date === fromDate && g.slotId === fromSlotId;
          return {
            slotId: g.slotId,
            startTime: g.startTime,
            endTime: g.endTime,
            available,
            status: isCurrent
              ? ("current" as const)
              : new Date(g.startsAt).getTime() <= limit
                ? ("past" as const)
                : available <= 0
                  ? ("full" as const)
                  : ("available" as const),
          };
        }),
      };
    }),
  };
}

export async function rescheduleMyClass(clientId: string, input: RescheduleInput): Promise<void> {
  if (!isSameWeek(input.fromDate, input.toDate)) throw new AppError("DIFFERENT_WEEK");
  await sql`
    select public.reschedule_class(
      ${clientId}::uuid, ${input.fromDate}::date, ${input.fromSlotId}::int,
      ${input.toDate}::date, ${input.toSlotId}::int
    )
  `;
}

export async function getMyProfile(clientId: string): Promise<ClientProfile> {
  const [[row], settings] = await Promise.all([
    sql<
      {
        id: string;
        full_name: string;
        email: string;
        document: string;
        phone: string;
        plan: Plan;
        monthly_fee: number;
        start_date: string;
        schedule: ScheduleEntry[];
      }[]
    >`
      select u.id, u.full_name, u.email, c.document, c.phone, c.plan, c.monthly_fee,
             c.start_date,
             coalesce((
               select json_agg(json_build_object(
                 'weekday', cs.weekday,
                 'slotId', cs.slot_id,
                 'startTime', to_char(ts.start_time, 'HH24:MI'),
                 'endTime', to_char(ts.end_time, 'HH24:MI')
               ) order by cs.weekday)
               from public.client_schedules cs
               join public.time_slots ts on ts.id = cs.slot_id
               where cs.client_id = c.user_id
             ), '[]'::json) as schedule
      from public.clients c
      join public.users u on u.id = c.user_id
      where c.user_id = ${clientId}::uuid
    `,
    getSettings(),
  ]);
  if (!row) throw new AppError("CLIENT_NOT_FOUND");
  return {
    id: row.id,
    fullName: row.full_name,
    document: row.document,
    phone: row.phone,
    email: row.email,
    plan: row.plan,
    monthlyFee: row.monthly_fee,
    startDate: row.start_date,
    schedule: row.schedule,
    contact: { whatsappPhone: settings.whatsappPhone, address: settings.address },
  };
}
