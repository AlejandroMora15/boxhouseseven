import { randomUUID } from "node:crypto";
import { addDaysISO, startOfMonthISO, todayISO } from "@/lib/dates";
import { toSearchText } from "@/lib/normalize";
import type { ClientData, ClientListQuery, ScheduleEntryInput } from "@/lib/schemas";
import type {
  ClientDetail,
  ClientListItem,
  ClientSearchResult,
  Paginated,
  ScheduleEntry,
} from "@/lib/types";
import type { Plan } from "@/lib/constants";
import { sql, type TransactionSql } from "../db";
import { AppError } from "../errors";
import { hashPassword } from "../auth/password";
import { forgetUserValidations, revokeUserSessions } from "../auth/sessions";
import { getClientClasses } from "./client-classes";
import { getSettings } from "./settings";
import { getActiveSlots } from "./slots";

interface ClientRow {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  document: string;
  phone: string;
  plan: Plan;
  monthly_fee: number;
  start_date: string;
  schedule: ScheduleEntry[];
}

function toListItem(row: ClientRow): ClientListItem {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    document: row.document,
    phone: row.phone,
    plan: row.plan,
    monthlyFee: row.monthly_fee,
    isActive: row.is_active,
    startDate: row.start_date,
    schedule: row.schedule ?? [],
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

// Horario semanal de `c.user_id` como JSON (para listados y detalle).
const scheduleJson = () => sql`
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
  ), '[]'::json)
`;

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export async function listClients(query: ClientListQuery): Promise<Paginated<ClientListItem>> {
  const term = toSearchText(query.q);
  const filters = sql`
    ${term ? sql`and c.search_text like ${`%${escapeLike(term)}%`}` : sql``}
    ${query.status === "active" ? sql`and u.is_active` : query.status === "inactive" ? sql`and not u.is_active` : sql``}
    ${query.plan !== "all" ? sql`and c.plan = ${query.plan}` : sql``}
  `;
  const order = query.sort === "recent" ? sql`u.created_at desc` : sql`u.full_name`;

  const offset = (query.page - 1) * query.pageSize;
  const [rows, [{ total }]] = await Promise.all([
    sql<ClientRow[]>`
      select u.id, u.full_name, u.email, u.is_active, c.document, c.phone, c.plan,
             c.monthly_fee, c.start_date,
             ${scheduleJson()} as schedule
      from public.clients c
      join public.users u on u.id = c.user_id
      where true ${filters}
      order by ${order}
      limit ${query.pageSize} offset ${offset}
    `,
    sql<{ total: number }[]>`
      select count(*)::int as total
      from public.clients c
      join public.users u on u.id = c.user_id
      where true ${filters}
    `,
  ]);

  return {
    items: rows.map(toListItem),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Búsqueda rápida (agregar a clase). */
export async function searchClients(q: string, limit = 8): Promise<ClientSearchResult[]> {
  const term = toSearchText(q);
  if (term.length < 2) return [];
  const rows = await sql<
    { id: string; full_name: string; document: string; plan: Plan; is_active: boolean }[]
  >`
    select u.id, u.full_name, c.document, c.plan, u.is_active
    from public.clients c
    join public.users u on u.id = c.user_id
    where c.search_text like ${`%${escapeLike(term)}%`}
    order by u.is_active desc, u.full_name
    limit ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    document: r.document,
    plan: r.plan,
    isActive: r.is_active,
  }));
}

export async function getClient(id: string): Promise<ClientDetail> {
  const monthStart = startOfMonthISO(todayISO());
  const [rows, settings] = await Promise.all([
    sql<
      (ClientRow & {
        notes: string | null;
        created_at: Date;
        trial: { id: string; classDate: string } | null;
        month_present: number;
        month_absent: number;
        last_attendance: string | null;
      })[]
    >`
      select u.id, u.full_name, u.email, u.is_active, u.created_at,
             c.document, c.phone, c.plan, c.monthly_fee, c.start_date, c.notes,
             ${scheduleJson()} as schedule,
             (select json_build_object('id', t.id, 'classDate', t.class_date)
                from public.trials t where t.converted_client_id = c.user_id limit 1) as trial,
             (select count(*)::int from public.attendance a
                where a.client_id = c.user_id and a.status = 'present' and a.class_date >= ${monthStart}::date) as month_present,
             (select count(*)::int from public.attendance a
                where a.client_id = c.user_id and a.status = 'absent' and a.class_date >= ${monthStart}::date) as month_absent,
             (select max(a.class_date) from public.attendance a
                where a.client_id = c.user_id and a.status = 'present') as last_attendance
      from public.clients c
      join public.users u on u.id = c.user_id
      where c.user_id = ${id}::uuid
    `,
    getSettings(),
  ]);
  const row = rows[0];
  if (!row) throw new AppError("CLIENT_NOT_FOUND");

  const today = todayISO();
  const upcoming = (await getClientClasses(id, today, addDaysISO(today, 13), settings.bookingCutoffMinutes))
    .filter((c) => new Date(c.startsAt).getTime() > Date.now() - 60 * 60_000)
    .slice(0, 6);

  return {
    ...toListItem(row),
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    trial: row.trial,
    stats: {
      monthPresent: row.month_present,
      monthAbsent: row.month_absent,
      lastAttendance: row.last_attendance,
    },
    upcoming,
  };
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

/** Verifica que cada día tenga una franja activa que aplique ese día. */
export async function assertScheduleSlots(schedule: ScheduleEntryInput[]): Promise<void> {
  const slots = await getActiveSlots();
  for (const entry of schedule) {
    const slot = slots.find((s) => s.id === entry.slotId);
    if (!slot || !slot.weekdays.includes(entry.weekday)) {
      throw new AppError("INVALID_SCHEDULE", {
        message: "Uno de los horarios seleccionados no está disponible ese día.",
        fields: { schedule: "Uno de los horarios seleccionados no está disponible ese día." },
      });
    }
  }
}

function clientSearchText(input: Pick<ClientData, "fullName" | "document" | "email" | "phone">) {
  return toSearchText(input.fullName, input.document, input.email, input.phone);
}

/** Inserta usuario + cliente + horario dentro de una transacción. */
async function insertClient(
  tx: TransactionSql,
  id: string,
  input: Omit<ClientData, "isActive"> & { isActive: boolean },
  passwordHash: string,
) {
  await tx`
    insert into public.users (id, role, email, password_hash, full_name, is_active)
    values (${id}::uuid, 'client', ${input.email}, ${passwordHash}, ${input.fullName}, ${input.isActive})
  `;
  await tx`
    insert into public.clients (
      user_id, document, phone, plan, monthly_fee, start_date, notes, search_text
    ) values (
      ${id}::uuid, ${input.document}, ${input.phone}, ${input.plan}, ${input.monthlyFee},
      ${input.startDate}::date, ${input.notes ?? null}, ${clientSearchText(input)}
    )
  `;
  if (input.schedule.length) {
    await tx`
      insert into public.client_schedules (client_id, weekday, slot_id)
      select ${id}::uuid, w, s
      from unnest(${input.schedule.map((s) => s.weekday)}::smallint[], ${input.schedule.map((s) => s.slotId)}::int[]) as x(w, s)
    `;
  }
}

export async function createClient(
  input: ClientData,
  opts: { trialId?: string } = {},
): Promise<{ id: string }> {
  await assertScheduleSlots(input.schedule);
  const id = randomUUID();
  // La contraseña del cliente es su documento.
  const passwordHash = await hashPassword(input.document);

  await sql.begin(async (tx) => {
    await insertClient(tx, id, input, passwordHash);
    if (opts.trialId) {
      const updated = await tx`
        update public.trials
        set status = 'converted', converted_client_id = ${id}::uuid, converted_at = now()
        where id = ${opts.trialId}::uuid and status <> 'converted'
        returning id
      `;
      if (!updated.length) throw new AppError("TRIAL_ALREADY_CONVERTED");
    } else {
      // Si la persona había agendado una clase de prueba, se vincula.
      await tx`
        update public.trials
        set status = 'converted', converted_client_id = ${id}::uuid, converted_at = now()
        where status <> 'converted' and (document = ${input.document} or email = ${input.email})
      `;
    }
  });

  return { id };
}

interface CurrentClientRow {
  document: string;
  is_active: boolean;
  schedule: { weekday: number; slotId: number }[];
}

export async function updateClient(id: string, input: ClientData): Promise<void> {
  const [current] = await sql<CurrentClientRow[]>`
    select c.document, u.is_active,
           coalesce((select json_agg(json_build_object('weekday', cs.weekday, 'slotId', cs.slot_id))
                     from public.client_schedules cs where cs.client_id = c.user_id), '[]'::json) as schedule
    from public.clients c
    join public.users u on u.id = c.user_id
    where c.user_id = ${id}::uuid
  `;
  if (!current) throw new AppError("CLIENT_NOT_FOUND");
  await assertScheduleSlots(input.schedule);

  const documentChanged = current.document !== input.document;
  const key = (s: { weekday: number; slotId: number }) => `${s.weekday}:${s.slotId}`;
  const scheduleChanged =
    current.schedule.map(key).sort().join("|") !== input.schedule.map(key).sort().join("|");
  const passwordHash = documentChanged ? await hashPassword(input.document) : null;

  await sql.begin(async (tx) => {
    await tx`
      update public.users
      set email = ${input.email},
          full_name = ${input.fullName},
          is_active = ${input.isActive},
          password_hash = coalesce(${passwordHash}, password_hash)
      where id = ${id}::uuid and role = 'client'
    `;
    await tx`
      update public.clients
      set document = ${input.document},
          phone = ${input.phone},
          plan = ${input.plan},
          monthly_fee = ${input.monthlyFee},
          start_date = ${input.startDate}::date,
          notes = ${input.notes ?? null},
          search_text = ${clientSearchText(input)}
      where user_id = ${id}::uuid
    `;
    if (scheduleChanged) {
      await tx`delete from public.client_schedules where client_id = ${id}::uuid`;
      await tx`
        insert into public.client_schedules (client_id, weekday, slot_id)
        select ${id}::uuid, w, s
        from unnest(${input.schedule.map((s) => s.weekday)}::smallint[], ${input.schedule.map((s) => s.slotId)}::int[]) as x(w, s)
      `;
      // Al cambiar el horario base se reinician los reagendamientos futuros.
      await tx`
        delete from public.schedule_exceptions
        where client_id = ${id}::uuid and source = 'reschedule' and class_date >= public.bogota_today()
      `;
    }
  });

  // Cambiar el documento cambia la contraseña: se cierran sus sesiones.
  if (documentChanged) await revokeUserSessions(id);
  if (current.is_active !== input.isActive) forgetUserValidations(id);
}

export async function setClientStatus(id: string, isActive: boolean): Promise<void> {
  const rows = await sql`
    update public.users set is_active = ${isActive}
    where id = ${id}::uuid and role = 'client'
    returning id
  `;
  if (!rows.length) throw new AppError("CLIENT_NOT_FOUND");
  forgetUserValidations(id);
}

export async function deleteClient(id: string): Promise<void> {
  const rows = await sql`delete from public.users where id = ${id}::uuid and role = 'client' returning id`;
  if (!rows.length) throw new AppError("CLIENT_NOT_FOUND");
  forgetUserValidations(id);
}
