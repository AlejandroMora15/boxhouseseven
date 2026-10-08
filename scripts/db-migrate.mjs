// Aplica las migraciones SQL de supabase/migrations en orden y crea/actualiza
// el rol de aplicación (bh7_app) con la clave de APP_DB_PASSWORD.
//
// Uso: npm run db:migrate
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const migrationsDir = path.join(root, "supabase", "migrations");

const adminUrl = process.env.DATABASE_ADMIN_URL;
const appPassword = process.env.APP_DB_PASSWORD;

if (!adminUrl || !appPassword) {
  console.error("Faltan DATABASE_ADMIN_URL o APP_DB_PASSWORD en .env.local");
  process.exit(1);
}
if (!/^[A-Za-z0-9_-]{16,}$/.test(appPassword)) {
  console.error("APP_DB_PASSWORD debe tener al menos 16 caracteres [A-Za-z0-9_-]");
  process.exit(1);
}

const sql = postgres(adminUrl, { max: 1, onnotice: () => {} });

try {
  // El rol se crea fuera de las migraciones para no guardar su clave en git.
  await sql.unsafe(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'bh7_app') then
        create role bh7_app login noinherit;
      end if;
    end
    $$;
  `);
  await sql.unsafe(`alter role bh7_app with login password '${appPassword}'`);
  await sql.unsafe(`alter role bh7_app set statement_timeout = '15s'`);

  await sql`create schema if not exists private`;
  await sql`
    create table if not exists private.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const applied = new Set(
    (await sql`select name from private.schema_migrations`).map((r) => r.name),
  );
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const content = await readFile(path.join(migrationsDir, file), "utf8");
    process.stdout.write(`→ Aplicando ${file}... `);
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`insert into private.schema_migrations (name) values (${file})`;
    });
    console.log("ok");
    count++;
  }

  console.log(count ? `✔ ${count} migración(es) aplicada(s).` : "✔ La base de datos ya está al día.");
} catch (error) {
  console.error("\n✖ Error aplicando migraciones:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
