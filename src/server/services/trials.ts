import { addDaysISO, todayISO, toHHMM } from "@/lib/dates";
import { toSearchText } from "@/lib/normalize";
import type {
  AdminTrialData,
  ConvertTrialData,
  TrialBookingData,
  TrialListQuery,
  TrialUpdateData,
} from "@/lib/schemas";
import type {
  AttendanceStatus,
  Paginated,
  PublicAvailability,
  TrialConfirmation,
  TrialItem,
  TrialStatus,
} from "@/lib/types";
import { sql } from "../db";
import { AppError } from "../errors";
import { getGrid } from "./agenda";
import { createClient } from "./clients";
import { getSettings } from "./settings";

interface TrialRow {
  id: string;
  full_name: string;
  document: string;
  phone: string;
  email: string;
  class_date: string;
  slot_id: number;
  start_time: string;
  end_time: string;
  status: TrialStatus;
  attendance: AttendanceStatus | null;
  source: "web" | "admin";
  notes: string | null;
  converted_client_id: string | null;
  created_at: Date;
}

function toTrial(row: TrialRow): TrialItem {
  return {
    id: row.id,
    fullName: row.full_name,
    document: row.document,
    phone: row.phone,
    email: row.email,
    classDate: row.class_date,
    slotId: row.slot_id,
    startTime: toHHMM(row.start_time),
    endTime: toHHMM(row.end_time),
    status: row.status,
    attendance: row.attendance,
    source: row.source,
    notes: row.notes,
    convertedClientId: row.converted_client_id,
    createdAt: row.created_at.toISOString(),
  };
}

const TRIAL_COLUMNS = sql`
  t.id, t.full_name, t.document, t.phone, t.email, t.class_date, t.slot_id,
  ts.start_time::text, ts.end_time::text, t.status, t.attendance, t.source, t.notes,
  t.converted_client_id, t.created_at
`;

// ---------------------------------------------------------------------------
// Flujo público
// ---------------------------------------------------------------------------

/** Verifica que la persona no sea cliente ni haya agendado una prueba antes. */
export async function assertNotRegistered(document: string, email: string, excludeTrialId?: string) {
  const [row] = await sql<{ status: "client" | "trial" | null }[]>`
    select public.registration_status(${document}, ${email}, ${excludeTrialId ?? null}::uuid) as status
  `;
  if (row.status === "client") throw new AppError("ALREADY_CLIENT");
  if (row.status === "trial") throw new AppError("ALREADY_TRIAL");
}

/** Cupos disponibles para clases de prueba (sin datos de asistentes). */
export async function getPublicAvailability(): Promise<PublicAvailability> {
  const settings = await getSettings();
  const today = todayISO();
  const to = addDaysISO(today, settings.trialWindowDays);
  const grid = await getGrid(today, to);
  const limit = Date.now() + settings.bookingCutoffMinutes * 60_000;

  const byDate = new Map<string, PublicAvailability["days"][number]>();
  for (const g of grid) {
    const day = byDate.get(g.date) ?? { date: g.date, closedReason: g.closedReason, slots: [] };
    const available = Math.max(0, g.capacity - g.booked);
    const status = g.closedReason
      ? "closed"
      : new Date(g.startsAt).getTime() <= limit
        ? "past"
        : available === 0
          ? "full"
          : "available";
    day.slots.push({
      slotId: g.slotId,
      startTime: g.startTime,
      endTime: g.endTime,
      available,
      bookable: status === "available",
      status,
    });
    byDate.set(g.date, day);
  }

  return {
    today,
    capacity: settings.maxPerClass,
    days: [...byDate.values()],
  };
}

export async function bookTrialPublic(input: TrialBookingData): Promise<TrialConfirmation> {
  await assertNotRegistered(input.document, input.email);
  let id: string;
  try {
    const [row] = await sql<{ id: string }[]>`
      select public.book_trial(
        ${input.fullName}, ${input.document}, ${input.phone}, ${input.email},
        ${input.classDate}::date, ${input.slotId}::int, 'web',
        ${toSearchText(input.fullName, input.document, input.email, input.phone)}
      ) as id
    `;
    id = row.id;
  } catch (error) {
    // Carrera: alguien se registró con estos datos entre la validación y el insert.
    if ((error as { message?: string }).message === "ALREADY_REGISTERED") {
      await assertNotRegistered(input.document, input.email);
    }
    throw error;
  }

  const [settings, [slot]] = await Promise.all([
    getSettings(),
    sql<{ start_time: string; end_time: string }[]>`
      select start_time::text, end_time::text from public.time_slots where id = ${input.slotId}
    `,
  ]);

  return {
    id,
    fullName: input.fullName,
    classDate: input.classDate,
    startTime: toHHMM(slot.start_time),
    endTime: toHHMM(slot.end_time),
    address: settings.address,
    whatsappPhone: settings.whatsappPhone,
  };
}

// ---------------------------------------------------------------------------
// Gestión (admin)
// ---------------------------------------------------------------------------

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function listTrials(query: TrialListQuery): Promise<Paginated<TrialItem>> {
  const term = toSearchText(query.q);
  const filters = sql`
    ${term ? sql`and t.search_text like ${`%${escapeLike(term)}%`}` : sql``}
    ${
      {
        all: sql``,
        scheduled: sql`and t.status = 'scheduled' and t.attendance is null`,
        attended: sql`and t.status <> 'cancelled' and t.attendance = 'present'`,
        no_show: sql`and t.status <> 'cancelled' and t.attendance = 'absent'`,
        converted: sql`and t.status = 'converted'`,
        cancelled: sql`and t.status = 'cancelled'`,
      }[query.status]
    }
    ${
      query.when === "upcoming"
        ? sql`and t.class_date >= public.bogota_today()`
        : query.when === "past"
          ? sql`and t.class_date < public.bogota_today()`
          : sql``
    }
  `;
  const order =
    query.when === "upcoming"
      ? sql`t.class_date asc, ts.start_time asc`
      : sql`t.class_date desc, ts.start_time desc`;

  const offset = (query.page - 1) * query.pageSize;
  const [rows, [{ total }]] = await Promise.all([
    sql<TrialRow[]>`
      select ${TRIAL_COLUMNS}
      from public.trials t
      join public.time_slots ts on ts.id = t.slot_id
      where true ${filters}
      order by ${order}
      limit ${query.pageSize} offset ${offset}
    `,
    sql<{ total: number }[]>`
      select count(*)::int as total from public.trials t where true ${filters}
    `,
  ]);

  return {
    items: rows.map(toTrial),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getTrial(id: string): Promise<TrialItem> {
  const [row] = await sql<TrialRow[]>`
    select ${TRIAL_COLUMNS}
    from public.trials t
    join public.time_slots ts on ts.id = t.slot_id
    where t.id = ${id}::uuid
  `;
  if (!row) throw new AppError("TRIAL_NOT_FOUND");
  return toTrial(row);
}

/** El admin agenda una prueba manualmente (sin límite de cupo). */
export async function createTrialByAdmin(input: AdminTrialData): Promise<TrialItem> {
  await assertNotRegistered(input.document, input.email);
  const [row] = await sql<{ id: string }[]>`
    select public.book_trial(
      ${input.fullName}, ${input.document}, ${input.phone}, ${input.email},
      ${input.classDate}::date, ${input.slotId}::int, 'admin',
      ${toSearchText(input.fullName, input.document, input.email, input.phone)},
      ${input.notes ?? null}
    ) as id
  `;
  return getTrial(row.id);
}

export async function updateTrial(id: string, input: TrialUpdateData): Promise<TrialItem> {
  const current = await getTrial(id);
  if (current.status === "converted") throw new AppError("TRIAL_ALREADY_CONVERTED");

  const [{ registered, starts }] = await sql<{ registered: string | null; starts: Date | null }[]>`
    select public.registration_status(${input.document}, ${input.email}, ${id}::uuid) as registered,
           public.class_starts_at(${input.classDate}::date, ${input.slotId}::int) as starts
  `;
  if (registered === "client") throw new AppError("ALREADY_REGISTERED", { message: "Ya existe un cliente con ese documento o correo." });
  if (registered === "trial") throw new AppError("ALREADY_REGISTERED", { message: "Otra clase de prueba ya usa ese documento o correo." });
  const classChanged = current.classDate !== input.classDate || current.slotId !== input.slotId;
  if (!starts && classChanged) throw new AppError("INVALID_CLASS");
  if (input.attendance && input.classDate > todayISO()) throw new AppError("FUTURE_ATTENDANCE");

  await sql`
    update public.trials
    set full_name = ${input.fullName},
        document = ${input.document},
        phone = ${input.phone},
        email = ${input.email},
        class_date = ${input.classDate}::date,
        slot_id = ${input.slotId},
        status = ${input.status},
        attendance = ${classChanged ? null : input.attendance},
        notes = ${input.notes ?? null},
        search_text = ${toSearchText(input.fullName, input.document, input.email, input.phone)}
    where id = ${id}::uuid
  `;
  return getTrial(id);
}

export async function deleteTrial(id: string): Promise<void> {
  const rows = await sql`delete from public.trials where id = ${id}::uuid returning id`;
  if (!rows.length) throw new AppError("TRIAL_NOT_FOUND");
}

/** Homologa una prueba a cliente: crea el cliente y marca la prueba. */
export async function convertTrial(id: string, input: ConvertTrialData): Promise<{ clientId: string }> {
  const trial = await getTrial(id);
  if (trial.status === "converted") throw new AppError("TRIAL_ALREADY_CONVERTED");

  // Solo debe chocar con otros registros distintos a esta misma prueba.
  const [{ registered }] = await sql<{ registered: string | null }[]>`
    select public.registration_status(${input.document}, ${input.email}, ${id}::uuid) as registered
  `;
  if (registered === "client") throw new AppError("ALREADY_REGISTERED", { message: "Ya existe un cliente con ese documento o correo." });
  if (registered === "trial") throw new AppError("ALREADY_REGISTERED", { message: "Otra clase de prueba ya usa ese documento o correo." });

  const { id: clientId } = await createClient({ ...input, isActive: true }, { trialId: id });
  return { clientId };
}
