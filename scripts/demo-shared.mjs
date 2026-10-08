// Dominio de correo reservado para los datos demo (no existe en internet).
export const DEMO_DOMAIN = "demo.bh7.test";

/** Borra todo lo creado por el script de datos demo. */
export async function clearDemo(sql) {
  await sql`create table if not exists private.demo_rows (kind text not null, key text not null, primary key (kind, key))`;
  const like = `%@${DEMO_DOMAIN}`;
  const [users] = await sql`
    with d as (delete from public.users where role = 'client' and email like ${like} returning 1)
    select count(*)::int as n from d
  `;
  const [trials] = await sql`
    with d as (delete from public.trials where email like ${like} returning 1)
    select count(*)::int as n from d
  `;
  const [plans] = await sql`
    with d as (
      delete from public.class_plans p
      using private.demo_rows r
      where r.kind = 'plan' and p.class_date = r.key::date
      returning 1
    )
    select count(*)::int as n from d
  `;
  await sql`delete from private.demo_rows`;
  return { users: users.n, trials: trials.n, plans: plans.n };
}
