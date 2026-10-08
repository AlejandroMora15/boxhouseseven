// Carga datos de demostración (clientes, horarios, pruebas, asistencias y
// planificación) para ver la app funcionando. Todo queda marcado y se borra
// con `npm run db:demo:clear`.
//
// Uso: npm run db:demo            (falla si ya hay datos demo)
//      npm run db:demo -- --reset (los borra y los vuelve a crear)
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import postgres from "postgres";
import { clearDemo, DEMO_DOMAIN } from "./demo-shared.mjs";

config({ path: ".env.local", quiet: true });

const sql = postgres(process.env.DATABASE_ADMIN_URL, { max: 1, onnotice: () => {} });

// Generador pseudoaleatorio con semilla (resultados reproducibles).
let seed = 7;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;

const FIRST = [
  "Juan", "Valentina", "Santiago", "Camila", "Andrés", "Daniela", "Sebastián", "Laura", "Mateo", "Sofía",
  "Carlos", "Isabella", "Felipe", "Mariana", "Julián", "Paula", "Alejandro", "Natalia", "David", "Manuela",
  "Esteban", "Juliana", "Miguel", "Carolina", "Tomás", "Luisa", "Nicolás", "Gabriela", "Samuel", "Ana María",
  "Diego", "Sara", "Jhon", "Melissa", "Cristian", "Paola", "Kevin", "Yuliana", "Brayan", "Lorena",
  "Óscar", "Ángela", "Jorge", "Mónica", "Hernán",
];
const LAST = [
  "Gómez", "Rodríguez", "Martínez", "López", "García", "Hernández", "Ramírez", "Torres", "Ríos", "Castaño",
  "Osorio", "Valencia", "Arango", "Giraldo", "Cardona", "Restrepo", "Marín", "Zapata", "Muñoz", "Ocampo",
  "Henao", "Montoya", "Quintero", "Salazar", "Betancur", "Londoño", "Agudelo", "Correa",
];

const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const searchText = (...parts) => strip(parts.filter(Boolean).join(" ")).trim();

function bogotaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}
function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function isoWeekday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

const PLANS_TEXT = [
  "Calentamiento: 3 rounds de cuerda (3 min).\nTécnica: jab–cross–hook en sombra, enfoque en la rotación de cadera.\nManoplas: combinaciones 1-2-3 y 1-2-esquiva.\nAcondicionamiento: 4 rounds de saco + burpees.\nCierre: core y estiramiento.",
  "Movilidad articular 10 min.\nDefensa: bloqueos, paradas y esquivas laterales en parejas.\nSparring técnico controlado (sin potencia) 4 × 2 min.\nFinal: sprints de 20 s en saco.",
  "Día de piernas y desplazamientos: escalera de agilidad, pivotes y cambios de guardia.\nCombinaciones al cuerpo (hook al hígado, uppercut).\nCircuito: sentadilla con salto, plancha, mountain climbers.",
  "Calentamiento con sombra 3 rounds.\nTrabajo de contragolpe: slip + cross, roll + hook.\nManoplas por parejas 5 × 3 min.\nAbdomen: 3 series de 20 crunches + 40 s de plancha.",
  "Clase de resistencia: 10 rounds de saco alternando 30 s fuerte / 30 s suave.\nTécnica de respiración y guardia.\nEstiramiento y vuelta a la calma.",
];

const TRIAL_PEOPLE = [
  ["Laura Sofía Bedoya", "1094887123", "3104567788"],
  ["Mateo Grajales Ruiz", "1088456321", "3127778899"],
  ["Daniela Pineda Soto", "1112789456", "3009876512"],
  ["Esteban Morales Gil", "1004321789", "3156543210"],
  ["Valeria Tabares Mejía", "1088990011", "3185554433"],
  ["Samuel Echeverry Ríos", "1094001122", "3017412589"],
  ["Mariana Duque Arias", "1115223344", "3203698521"],
];

async function main() {
  const reset = process.argv.includes("--reset");
  const [{ count }] = await sql`select count(*)::int as count from public.users where email like ${"%@" + DEMO_DOMAIN}`;
  if (count > 0) {
    if (!reset) {
      console.log(`Ya hay ${count} clientes demo. Usa "npm run db:demo -- --reset" para recrearlos.`);
      return;
    }
    await clearDemo(sql);
  }

  const slots = await sql`select id, start_time::text as start, weekdays from public.time_slots where is_active order by start_time`;
  if (!slots.length) throw new Error("No hay franjas horarias activas.");
  const [settings] = await sql`select price_three_days, price_daily from public.settings where id`;

  // Franjas populares pesan más (6-7 am y 5-7 pm).
  const weighted = slots.flatMap((s) => {
    const h = Number(s.start.slice(0, 2));
    const w = h === 6 || h === 17 || h === 18 ? 4 : h === 7 || h === 19 ? 3 : 2;
    return Array(w).fill(s);
  });
  const THREE_DAY_PATTERNS = [[1, 3, 5], [1, 3, 5], [2, 4, 5], [1, 2, 4], [2, 3, 5], [1, 4, 5]];

  const today = bogotaToday();
  const users = [];
  const clients = [];
  const schedules = [];
  const usedEmails = new Set();
  const total = 44;

  console.log("→ Generando hashes de contraseña…");
  for (let i = 0; i < total; i++) {
    const first = FIRST[i % FIRST.length];
    const last1 = pick(LAST);
    let last2 = pick(LAST);
    if (last2 === last1) last2 = pick(LAST);
    const fullName = `${first} ${last1} ${last2}`;
    const document = String(1004000000 + Math.floor(rand() * 115000000));
    const phone = `3${pick(["00", "01", "04", "10", "12", "13", "14", "15", "16", "17", "18", "20", "22"])}${String(Math.floor(rand() * 10_000_000)).padStart(7, "0")}`;
    let email = `${strip(first).replace(/\s+/g, "")}.${strip(last1)}@${DEMO_DOMAIN}`;
    let n = 2;
    while (usedEmails.has(email)) email = `${strip(first).replace(/\s+/g, "")}.${strip(last1)}${n++}@${DEMO_DOMAIN}`;
    usedEmails.add(email);

    const plan = chance(0.42) ? "daily" : "three_days";
    const startDate = addDays(today, -Math.floor(15 + rand() * 170));
    const id = crypto.randomUUID();
    users.push({
      id,
      role: "client",
      email,
      password_hash: await bcrypt.hash(document, 10),
      full_name: fullName,
      is_active: i % 11 !== 5, // ~4 inactivos
    });
    clients.push({
      user_id: id,
      document,
      phone,
      plan,
      monthly_fee: plan === "daily" ? settings.price_daily : settings.price_three_days,
      start_date: startDate,
      notes: i % 9 === 0 ? "Prefiere entrenar con guantes de 14 oz." : null,
      search_text: searchText(fullName, document, email, phone),
    });

    const mainSlot = pick(weighted);
    const days = plan === "daily" ? [1, 2, 3, 4, 5] : pick(THREE_DAY_PATTERNS);
    for (const weekday of days) {
      // Algunos clientes varían la hora algún día de la semana.
      const slot = chance(0.12) ? pick(weighted) : mainSlot;
      const valid = slot.weekdays.map(Number).includes(weekday) ? slot : slots.find((s) => s.weekdays.map(Number).includes(weekday));
      schedules.push({ client_id: id, weekday, slot_id: valid.id });
    }
  }

  await sql.begin(async (tx) => {
    await tx`insert into public.users ${tx(users, "id", "role", "email", "password_hash", "full_name", "is_active")}`;
    await tx`insert into public.clients ${tx(clients, "user_id", "document", "phone", "plan", "monthly_fee", "start_date", "notes", "search_text")}`;
    await tx`insert into public.client_schedules ${tx(schedules, "client_id", "weekday", "slot_id")}`;
  });
  console.log(`✔ ${users.length} clientes con su horario semanal`);

  // Reagendamientos: algunos clientes de 3 días movieron una clase esta semana.
  const monday = addDays(today, 1 - isoWeekday(today));
  const threeDay = clients.filter((c) => c.plan === "three_days").slice(0, 4);
  let moved = 0;
  for (const c of threeDay) {
    const own = schedules.filter((s) => s.client_id === c.user_id);
    const from = own[0];
    const fromDate = addDays(monday, from.weekday - 1);
    const freeDays = [1, 2, 3, 4, 5].filter((d) => !own.some((s) => s.weekday === d));
    if (!freeDays.length) continue;
    const toWeekday = pick(freeDays);
    const toDate = addDays(monday, toWeekday - 1);
    const toSlot = pick(slots.filter((s) => s.weekdays.map(Number).includes(toWeekday)));
    const group = crypto.randomUUID();
    await sql`
      insert into public.schedule_exceptions (client_id, class_date, slot_id, kind, source, reschedule_group, created_by)
      values (${c.user_id}, ${fromDate}, ${from.slot_id}, 'remove', 'reschedule', ${group}, ${c.user_id}),
             (${c.user_id}, ${toDate}, ${toSlot.id}, 'add', 'reschedule', ${group}, ${c.user_id})
    `;
    moved++;
  }
  console.log(`✔ ${moved} clases reagendadas esta semana`);

  // Clases de prueba (algunas pasadas, otras próximas).
  const trialRows = [];
  const offsets = [-6, -3, -1, 1, 2, 5, 8];
  TRIAL_PEOPLE.forEach(([name, doc, phone], i) => {
    let date = addDays(today, offsets[i]);
    while (isoWeekday(date) > 5) date = addDays(date, 1);
    const slot = pick(slots.filter((s) => s.weekdays.map(Number).includes(isoWeekday(date))));
    const past = date < today;
    trialRows.push({
      full_name: name,
      document: doc,
      phone,
      email: `${strip(name.split(" ")[0])}.${strip(name.split(" ")[1])}@${DEMO_DOMAIN}`,
      class_date: date,
      slot_id: slot.id,
      status: i === 6 ? "cancelled" : "scheduled",
      attendance: past ? (i === 1 ? "absent" : "present") : null,
      source: i % 3 === 0 ? "admin" : "web",
      search_text: "",
    });
  });
  for (const t of trialRows) t.search_text = searchText(t.full_name, t.document, t.email, t.phone);
  await sql`insert into public.trials ${sql(trialRows, "full_name", "document", "phone", "email", "class_date", "slot_id", "status", "attendance", "source", "search_text")}`;
  console.log(`✔ ${trialRows.length} clases de prueba`);

  // Asistencia de las últimas 3 semanas (hasta las clases que ya terminaron hoy).
  const from = addDays(monday, -14);
  const marked = await sql`
    insert into public.attendance (class_date, slot_id, client_id, status)
    select e.class_date, e.slot_id, e.person_id,
           case when random() < 0.86 then 'present' else 'absent' end
    from public.class_entries(${from}::date, ${today}::date) e
    join public.users u on u.id = e.person_id and u.email like ${"%@" + DEMO_DOMAIN}
    join public.time_slots ts on ts.id = e.slot_id
    where e.entry_type = 'client'
      and (e.class_date + ts.end_time) at time zone 'America/Bogota' < now()
    on conflict do nothing
    returning 1
  `;
  console.log(`✔ ${marked.length} asistencias registradas`);

  // Planificación de esta semana y la siguiente (solo días sin plan previo).
  let plans = 0;
  for (let i = 0; i < 12; i++) {
    const date = addDays(monday, i);
    if (isoWeekday(date) > 5) continue;
    const inserted = await sql`
      insert into public.class_plans (class_date, content)
      values (${date}, ${PLANS_TEXT[plans % PLANS_TEXT.length]})
      on conflict (class_date) do nothing
      returning class_date
    `;
    if (inserted.length) {
      await sql`insert into private.demo_rows (kind, key) values ('plan', ${date}) on conflict do nothing`;
      plans++;
    }
  }
  console.log(`✔ ${plans} días con planificación`);
  console.log("\nListo. Todos los clientes demo usan su documento como contraseña.");
  const sample = users.find((u) => u.is_active);
  const sampleDoc = clients.find((c) => c.user_id === sample.id).document;
  console.log(`Ejemplo de cliente: ${sample.email} / ${sampleDoc}`);
}

try {
  await sql`create table if not exists private.demo_rows (kind text not null, key text not null, primary key (kind, key))`;
  await main();
} catch (error) {
  console.error("✖ Error:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
