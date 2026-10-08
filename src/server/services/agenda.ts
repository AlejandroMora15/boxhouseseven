import { addDaysISO, startOfWeekISO, toHHMM } from "@/lib/dates";
import type {
  AgendaClass,
  AgendaDay,
  AgendaWeek,
  AttendanceStatus,
  EntryOrigin,
  GridClass,
  RosterEntry,
  TrialStatus,
} from "@/lib/types";
import type { Plan } from "@/lib/constants";
import { sql } from "../db";
import { AppError } from "../errors";
import { getActiveSlots } from "./slots";

interface GridRow {
  class_date: string;
  slot_id: number;
  start_time: string;
  end_time: string;
  starts_at: Date;
  closed_reason: string | null;
  booked: number;
  trials: number;
  capacity: number;
}

function toGridClass(row: GridRow): GridClass {
  return {
    date: row.class_date,
    slotId: row.slot_id,
    startTime: toHHMM(row.start_time),
    endTime: toHHMM(row.end_time),
    startsAt: row.starts_at.toISOString(),
    closedReason: row.closed_reason,
    booked: row.booked,
    trials: row.trials,
    capacity: row.capacity,
  };
}

/** Grilla de clases con cupos ocupados entre dos fechas (inclusive). */
export async function getGrid(from: string, to: string): Promise<GridClass[]> {
  const rows = await sql<GridRow[]>`
    select class_date, slot_id, start_time::text, end_time::text, starts_at,
           closed_reason, booked, trials, capacity
    from public.class_grid(${from}::date, ${to}::date)
  `;
  return rows.map(toGridClass);
}

interface RosterRow {
  slot_id: number;
  entry_type: "client" | "trial";
  person_id: string;
  origin: EntryOrigin;
  attendance: AttendanceStatus | null;
  full_name: string;
  phone: string;
  email: string;
  document: string;
  plan: Plan | null;
  is_active: boolean;
  trial_status: TrialStatus | null;
  moved_from_date: string | null;
  moved_from_time: string | null;
}

async function getRoster(date: string): Promise<RosterRow[]> {
  return sql<RosterRow[]>`
    select e.slot_id, e.entry_type, e.person_id, e.origin, e.attendance,
           coalesce(u.full_name, t.full_name) as full_name,
           coalesce(c.phone, t.phone) as phone,
           coalesce(u.email, t.email) as email,
           coalesce(c.document, t.document) as document,
           c.plan,
           coalesce(u.is_active, true) as is_active,
           t.status as trial_status,
           mf.class_date as moved_from_date,
           mfs.start_time::text as moved_from_time
    from public.class_entries(${date}::date, ${date}::date) e
    left join public.users u on e.entry_type = 'client' and u.id = e.person_id
    left join public.clients c on e.entry_type = 'client' and c.user_id = e.person_id
    left join public.trials t on e.entry_type = 'trial' and t.id = e.person_id
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
    order by e.entry_type, coalesce(u.full_name, t.full_name)
  `;
}

function toRosterEntry(row: RosterRow): RosterEntry {
  return {
    type: row.entry_type,
    id: row.person_id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    document: row.document,
    plan: row.plan,
    isActive: row.is_active,
    origin: row.origin,
    attendance: row.attendance,
    trialStatus: row.trial_status,
    movedFrom:
      row.moved_from_date && row.moved_from_time
        ? { date: row.moved_from_date, startTime: toHHMM(row.moved_from_time) }
        : null,
  };
}

export async function getAgendaDay(date: string): Promise<AgendaDay> {
  const [grid, roster, [meta]] = await Promise.all([
    getGrid(date, date),
    getRoster(date),
    sql<{ closed_reason: string | null; plan: { content: string; updatedAt: string } | null; capacity: number }[]>`
      select
        (select reason from public.closed_days where day = ${date}::date) as closed_reason,
        (select json_build_object('content', content, 'updatedAt', updated_at)
           from public.class_plans where class_date = ${date}::date) as plan,
        (select max_per_class::int from public.settings where id) as capacity
    `,
  ]);

  const bySlot = new Map<number, RosterEntry[]>();
  for (const row of roster) {
    const list = bySlot.get(row.slot_id) ?? [];
    list.push(toRosterEntry(row));
    bySlot.set(row.slot_id, list);
  }

  const classes: AgendaClass[] = grid.map((g) => ({ ...g, attendees: bySlot.get(g.slotId) ?? [] }));

  return {
    date,
    closedReason: meta.closed_reason,
    capacity: meta.capacity,
    plan: meta.plan,
    classes,
  };
}

export async function getAgendaWeek(date: string): Promise<AgendaWeek> {
  const weekStart = startOfWeekISO(date);
  const weekEnd = addDaysISO(weekStart, 6);
  const [grid, slots, plans, closed, [settings]] = await Promise.all([
    getGrid(weekStart, weekEnd),
    getActiveSlots(),
    sql<{ class_date: string }[]>`
      select class_date from public.class_plans
      where class_date between ${weekStart}::date and ${weekEnd}::date and content <> ''
    `,
    sql<{ day: string; reason: string }[]>`
      select day, reason from public.closed_days
      where day between ${weekStart}::date and ${weekEnd}::date
    `,
    sql<{ capacity: number }[]>`select max_per_class::int as capacity from public.settings where id`,
  ]);

  const planDates = new Set(plans.map((p) => p.class_date));
  const closedMap = new Map(closed.map((c) => [c.day, c.reason]));

  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i))
    .map((d) => ({
      date: d,
      closedReason: closedMap.get(d) ?? null,
      hasPlan: planDates.has(d),
      classes: grid.filter((g) => g.date === d),
    }))
    // Lunes a viernes siempre; fin de semana solo si tiene clases.
    .filter((d, i) => i < 5 || d.classes.length > 0);

  return { weekStart, capacity: settings.capacity, slots, days };
}

// ---------------------------------------------------------------------------
// Acciones del admin sobre una clase
// ---------------------------------------------------------------------------

export async function setClientAttendance(
  adminId: string,
  input: { clientId: string; date: string; slotId: number; status: AttendanceStatus | null },
) {
  await sql`
    select public.set_attendance(
      ${adminId}::uuid, ${input.clientId}::uuid, ${input.date}::date, ${input.slotId}::int, ${input.status}::text
    )
  `;
}

export async function setTrialAttendance(input: {
  trialId: string;
  date: string;
  slotId: number;
  status: AttendanceStatus | null;
}) {
  const [row] = await sql<{ id: string; future: boolean }[]>`
    select id, class_date > public.bogota_today() as future
    from public.trials
    where id = ${input.trialId}::uuid
      and class_date = ${input.date}::date
      and slot_id = ${input.slotId}
      and status <> 'cancelled'
  `;
  if (!row) throw new AppError("NOT_IN_CLASS", { message: "La clase de prueba no está en esta clase." });
  if (row.future) throw new AppError("FUTURE_ATTENDANCE");
  await sql`update public.trials set attendance = ${input.status} where id = ${input.trialId}::uuid`;
}

export async function setClassAttendance(
  adminId: string,
  input: { date: string; slotId: number; status: AttendanceStatus },
): Promise<number> {
  const [row] = await sql<{ updated: number }[]>`
    select public.set_class_attendance(
      ${adminId}::uuid, ${input.date}::date, ${input.slotId}::int, ${input.status}::text
    ) as updated
  `;
  return row.updated;
}

export async function addClientToClass(
  adminId: string,
  input: { clientId: string; date: string; slotId: number; markPresent: boolean },
) {
  await sql`
    select public.admin_add_to_class(
      ${adminId}::uuid, ${input.clientId}::uuid, ${input.date}::date, ${input.slotId}::int, ${input.markPresent}::boolean
    )
  `;
}

export async function removeClientFromClass(
  adminId: string,
  input: { clientId: string; date: string; slotId: number },
) {
  await sql`
    select public.admin_remove_from_class(
      ${adminId}::uuid, ${input.clientId}::uuid, ${input.date}::date, ${input.slotId}::int
    )
  `;
}
