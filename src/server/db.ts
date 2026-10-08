import "server-only";
import postgres from "postgres";

// Conexión a Supabase Postgres a través del pooler (modo transacción) con el
// rol de mínimo privilegio bh7_app. Se reutiliza una sola instancia por
// proceso (también entre recargas en caliente de `next dev`).

declare global {
  var __bh7Sql: postgres.Sql | undefined;
}

function createClient(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL no está configurada. Revisa el archivo .env.local");
  }
  return postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 15,
    // El pooler en modo transacción no admite sentencias preparadas con nombre.
    prepare: false,
    ssl: "require",
    onnotice: () => {},
    types: {
      // Las fechas (sin hora) se manejan como texto "YYYY-MM-DD" para evitar
      // corrimientos por zona horaria. Los timestamptz siguen llegando como Date.
      dateOnly: {
        to: 1082,
        from: [1082],
        serialize: (value: string) => value,
        parse: (value: string) => value,
      },
    },
  });
}

export const sql: postgres.Sql = globalThis.__bh7Sql ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__bh7Sql = sql;
}

export type Sql = postgres.Sql;
export type TransactionSql = postgres.TransactionSql;
