// Elimina los datos de demostración (clientes, pruebas y planes creados por
// `npm run db:demo`). No toca datos reales ni la configuración.
import { config } from "dotenv";
import postgres from "postgres";
import { clearDemo } from "./demo-shared.mjs";

config({ path: ".env.local", quiet: true });
const sql = postgres(process.env.DATABASE_ADMIN_URL, { max: 1, onnotice: () => {} });

try {
  const result = await clearDemo(sql);
  console.log(
    `✔ Datos demo eliminados: ${result.users} clientes, ${result.trials} pruebas, ${result.plans} planificaciones.`,
  );
} catch (error) {
  console.error("✖ Error:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
