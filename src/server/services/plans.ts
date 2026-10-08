import type { ClassPlan } from "@/lib/types";
import { sql } from "../db";

export async function listPlans(from: string, to: string): Promise<ClassPlan[]> {
  const rows = await sql<{ class_date: string; content: string; updated_at: Date }[]>`
    select class_date, content, updated_at
    from public.class_plans
    where class_date between ${from}::date and ${to}::date
    order by class_date
  `;
  return rows.map((r) => ({ date: r.class_date, content: r.content, updatedAt: r.updated_at.toISOString() }));
}

/** Guarda la planificación del día; si queda vacía se elimina. */
export async function savePlan(date: string, content: string, adminId: string): Promise<ClassPlan | null> {
  const text = content.trim();
  if (!text) {
    await sql`delete from public.class_plans where class_date = ${date}::date`;
    return null;
  }
  const [row] = await sql<{ class_date: string; content: string; updated_at: Date }[]>`
    insert into public.class_plans (class_date, content, updated_by)
    values (${date}::date, ${text}, ${adminId}::uuid)
    on conflict (class_date)
    do update set content = excluded.content, updated_by = excluded.updated_by
    returning class_date, content, updated_at
  `;
  return { date: row.class_date, content: row.content, updatedAt: row.updated_at.toISOString() };
}
