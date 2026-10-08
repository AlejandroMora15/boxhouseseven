import { toHHMM } from "@/lib/dates";
import type { AttendanceHistory, AttendanceStatus, ClientClass, EntryOrigin } from "@/lib/types";
import { endOfMonthISO, startOfMonthISO } from "@/lib/dates";
import { sql } from "../db";

interface ClientClassRow {
  class_date: string;
  slot_id: number;
  origin: Exclude<EntryOrigin, "trial">;
  attendance: AttendanceStatus | null;
  start_time: string;
  end_time: string;
  starts_at: Date;
  closed_reason: string | null;
  moved_from_date: string | null;
  moved_from_time: string | null;
}

/** Clases de un cliente entre dos fechas, con asistencia y origen. */
export async function getClientClasses(
  clientId: string,
  from: string,
  to: string,
  cutoffMinutes: number,
): Promise<ClientClass[]> {
  const rows = await sql<ClientClassRow[]>`
    select e.class_date, e.slot_id, e.origin, e.attendance,
           ts.start_time::text, ts.end_time::text,
           (e.class_date + ts.start_time) at time zone 'America/Bogota' as starts_at,
           cd.reason as closed_reason,
           mf.class_date as moved_from_date,
           mfs.start_time::text as moved_from_time
    from public.class_entries(${from}::date, ${to}::date, ${clientId}::uuid) e
    join public.time_slots ts on ts.id = e.slot_id
    left join public.closed_days cd on cd.day = e.class_date
    left join lateral (
      select se.class_date, se.slot_id
      from public.schedule_exceptions se
      where e.reschedule_group is not null
        and se.reschedule_group = e.reschedule_group
        and se.client_id = e.person_id
        and se.kind = 'remove'
      limit 1
    ) mf on true
    left join public.time_slots mfs on mfs.id = mf.slot_id
    order by e.class_date, ts.start_time
  `;

  const limit = Date.now() + cutoffMinutes * 60_000;
  return rows.map((r) => ({
    date: r.class_date,
    slotId: r.slot_id,
    startTime: toHHMM(r.start_time),
    endTime: toHHMM(r.end_time),
    startsAt: r.starts_at.toISOString(),
    origin: r.origin,
    attendance: r.attendance,
    closedReason: r.closed_reason,
    movedFrom:
      r.moved_from_date && r.moved_from_time
        ? { date: r.moved_from_date, startTime: toHHMM(r.moved_from_time) }
        : null,
    canReschedule: r.origin !== "attendance" && r.attendance === null && r.starts_at.getTime() > limit,
  }));
}

/** Historial de asistencias registradas de un cliente en un mes. */
export async function getAttendanceHistory(clientId: string, monthISO: string): Promise<AttendanceHistory> {
  const from = startOfMonthISO(monthISO);
  const to = endOfMonthISO(monthISO);
  const rows = await sql<
    { class_date: string; slot_id: number; start_time: string; end_time: string; status: AttendanceStatus }[]
  >`
    select a.class_date, a.slot_id, ts.start_time::text, ts.end_time::text, a.status
    from public.attendance a
    join public.time_slots ts on ts.id = a.slot_id
    where a.client_id = ${clientId}::uuid
      and a.class_date between ${from}::date and ${to}::date
    order by a.class_date desc, ts.start_time desc
  `;
  const present = rows.filter((r) => r.status === "present").length;
  const absent = rows.length - present;
  return {
    month: from,
    items: rows.map((r) => ({
      date: r.class_date,
      slotId: r.slot_id,
      startTime: toHHMM(r.start_time),
      endTime: toHHMM(r.end_time),
      status: r.status,
    })),
    summary: { present, absent, rate: rows.length ? Math.round((present / rows.length) * 100) : null },
  };
}
