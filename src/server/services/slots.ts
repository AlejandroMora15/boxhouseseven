import { weekdayLabel } from "@/lib/constants";
import { toHHMM } from "@/lib/dates";
import type { SlotData } from "@/lib/schemas";
import type { TimeSlot, TimeSlotWithUsage } from "@/lib/types";
import { cached, invalidate as invalidateCache } from "../cache";
import { sql } from "../db";
import { AppError } from "../errors";

const SLOTS_KEY = "time-slots";
const TTL_MS = 10 * 60_000;

interface SlotRow {
  id: number;
  start_time: string;
  end_time: string;
  weekdays: number[];
  is_active: boolean;
}

function toSlot(row: SlotRow): TimeSlot {
  return {
    id: row.id,
    startTime: toHHMM(row.start_time),
    endTime: toHHMM(row.end_time),
    weekdays: row.weekdays.map(Number),
    isActive: row.is_active,
  };
}

/** Franjas activas ordenadas por hora (en caché hasta que cambien). */
export function getActiveSlots(): Promise<TimeSlot[]> {
  return cached(SLOTS_KEY, TTL_MS, async () => {
    const rows = await sql<SlotRow[]>`
      select id, start_time::text, end_time::text, weekdays, is_active
      from public.time_slots
      where is_active
      order by start_time
    `;
    return rows.map(toSlot);
  });
}

export async function getSlotsWithUsage(): Promise<TimeSlotWithUsage[]> {
  const [slots, usage] = await Promise.all([
    getActiveSlots(),
    sql<{ slot_id: number; weekday: number; active: number; total: number }[]>`
      select cs.slot_id, cs.weekday,
             count(*) filter (where u.is_active)::int as active,
             count(*)::int as total
      from public.client_schedules cs
      join public.users u on u.id = cs.client_id
      group by cs.slot_id, cs.weekday
    `,
  ]);
  return slots.map((slot) => {
    const rows = usage.filter((u) => u.slot_id === slot.id);
    const clientsByWeekday: Record<number, number> = {};
    for (const r of rows) clientsByWeekday[r.weekday] = r.active;
    return { ...slot, clientsByWeekday, totalClients: rows.reduce((acc, r) => acc + r.total, 0) };
  });
}

function invalidate() {
  invalidateCache(SLOTS_KEY);
}

export async function createSlot(input: SlotData): Promise<TimeSlot> {
  const [row] = await sql<SlotRow[]>`
    insert into public.time_slots (start_time, end_time, weekdays)
    values (${input.startTime}::time, ${input.endTime}::time, ${input.weekdays}::smallint[])
    returning id, start_time::text, end_time::text, weekdays, is_active
  `;
  invalidate();
  return toSlot(row);
}

/** Uso de una franja en ciertos días: horarios fijos y clases futuras. */
async function usageOnWeekdays(slotId: number, weekdays: number[]) {
  const [row] = await sql<{ schedules: number; future: number }[]>`
    select
      (select count(*)::int from public.client_schedules cs
        where cs.slot_id = ${slotId} and cs.weekday = any (${weekdays}::smallint[])) as schedules,
      (select count(*)::int from (
        select se.class_date from public.schedule_exceptions se
        where se.slot_id = ${slotId} and se.kind = 'add' and se.class_date >= public.bogota_today()
        union all
        select t.class_date from public.trials t
        where t.slot_id = ${slotId} and t.status <> 'cancelled' and t.class_date >= public.bogota_today()
      ) f where extract(isodow from f.class_date)::smallint = any (${weekdays}::smallint[])) as future
  `;
  return row;
}

function inUseError(usage: { schedules: number; future: number }, days: number[], action: string) {
  const parts: string[] = [];
  if (usage.schedules) parts.push(`${usage.schedules} cliente(s) la tienen en su horario`);
  if (usage.future) parts.push(`${usage.future} clase(s) futura(s) agendada(s)`);
  const dayText = days.length < 7 ? ` (${days.map((d) => weekdayLabel(d)).join(", ")})` : "";
  return new AppError("SLOT_IN_USE", {
    message: `No se puede ${action}: ${parts.join(" y ")}${dayText}. Reasigna esos horarios primero.`,
    details: usage,
  });
}

export async function updateSlot(id: number, input: SlotData): Promise<TimeSlot> {
  const [current] = await sql<SlotRow[]>`
    select id, start_time::text, end_time::text, weekdays, is_active
    from public.time_slots where id = ${id} and is_active
  `;
  if (!current) throw new AppError("SLOT_NOT_FOUND");

  const removedDays = current.weekdays.map(Number).filter((d) => !input.weekdays.includes(d));
  if (removedDays.length) {
    const usage = await usageOnWeekdays(id, removedDays);
    if (usage.schedules || usage.future) throw inUseError(usage, removedDays, "quitar esos días");
  }

  const [row] = await sql<SlotRow[]>`
    update public.time_slots
    set start_time = ${input.startTime}::time,
        end_time = ${input.endTime}::time,
        weekdays = ${input.weekdays}::smallint[]
    where id = ${id}
    returning id, start_time::text, end_time::text, weekdays, is_active
  `;
  invalidate();
  return toSlot(row);
}

/**
 * Elimina una franja. Si tiene historial (asistencias, pruebas pasadas) se
 * archiva para conservarlo; si nunca se usó se borra definitivamente.
 */
export async function deleteSlot(id: number): Promise<{ archived: boolean }> {
  const [current] = await sql<SlotRow[]>`
    select id, start_time::text, end_time::text, weekdays, is_active
    from public.time_slots where id = ${id} and is_active
  `;
  if (!current) throw new AppError("SLOT_NOT_FOUND");

  const allDays = [1, 2, 3, 4, 5, 6, 7];
  const usage = await usageOnWeekdays(id, allDays);
  if (usage.schedules || usage.future) throw inUseError(usage, allDays, "eliminar esta franja");

  const [history] = await sql<{ used: boolean }[]>`
    select exists (select 1 from public.attendance where slot_id = ${id})
        or exists (select 1 from public.schedule_exceptions where slot_id = ${id})
        or exists (select 1 from public.trials where slot_id = ${id}) as used
  `;

  if (history.used) {
    await sql`update public.time_slots set is_active = false where id = ${id}`;
  } else {
    await sql`delete from public.time_slots where id = ${id}`;
  }
  invalidate();
  return { archived: history.used };
}
