import type { ClosedDaysData } from "@/lib/schemas";
import type { ClosedDay } from "@/lib/types";
import { sql } from "../db";
import { AppError } from "../errors";

export async function listClosedDays(from: string, to: string): Promise<ClosedDay[]> {
  return sql<ClosedDay[]>`
    select day, reason from public.closed_days
    where day between ${from}::date and ${to}::date
    order by day
  `;
}

/** Marca días como cerrados (ignora los que ya lo estaban). */
export async function addClosedDays(
  input: ClosedDaysData,
): Promise<{ added: ClosedDay[]; skipped: number; affected: number }> {
  const days = input.days.map((d) => d.day);
  const reasons = input.days.map((d) => d.reason);
  const added = await sql<ClosedDay[]>`
    insert into public.closed_days (day, reason)
    select * from unnest(${days}::date[], ${reasons}::text[])
    on conflict (day) do nothing
    returning day, reason
  `;
  if (input.days.length === 1 && added.length === 0) throw new AppError("DAY_ALREADY_CLOSED");

  // Personas que tenían clase en los días cerrados (para avisarles).
  let affected = 0;
  if (added.length) {
    const [row] = await sql<{ total: number }[]>`
      select coalesce(sum(n), 0)::int as total from (
        select count(*) as n
        from unnest(${added.map((d) => d.day)}::date[]) as d(day),
             lateral public.class_entries(d.day, d.day) e
      ) x
    `;
    affected = row.total;
  }
  return { added, skipped: input.days.length - added.length, affected };
}

export async function removeClosedDay(day: string): Promise<void> {
  const rows = await sql`delete from public.closed_days where day = ${day}::date returning day`;
  if (!rows.length) throw new AppError("NOT_FOUND");
}
