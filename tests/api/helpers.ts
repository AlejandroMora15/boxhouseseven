// Utilidades para las pruebas de integración de la API. Hablan con el
// servidor real (`npm run dev`) y la base de datos de Supabase.
import { randomInt, randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";
import { addDaysISO, startOfWeekISO, todayISO } from "@/lib/dates";

config({ path: ".env.local", quiet: true });

export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
export const TEST_DOMAIN = "test.bh7.test";
export const ADMIN = { email: "boxhouseseven.tech@gmail.com", password: "123456" };
export const TEST_CLOSED_REASON = "TEST · día cerrado";
export const TEST_PLAN_DATE = "2099-12-31";

/** Conexión administrativa para preparar y limpiar datos de prueba. */
export function adminDb() {
  return postgres(process.env.DATABASE_ADMIN_URL!, { max: 2, onnotice: () => {} });
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

/** Cliente HTTP con "cookie jar" (simula un navegador). */
export class Session {
  readonly cookies = new Map<string, string>();
  constructor(readonly ip = randomIp()) {}

  cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  absorb(headers: Headers) {
    for (const raw of headers.getSetCookie()) {
      const [pair, ...attrs] = raw.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attrs.some((a) => /max-age=0/i.test(a)) || value === "";
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async request<T = any>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<ApiResponse<T>> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      redirect: "manual",
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        cookie: this.cookieHeader(),
        "x-forwarded-for": this.ip,
        ...extraHeaders,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    this.absorb(res.headers);
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // HTML u otro contenido
    }
    return { status: res.status, body: parsed as T, headers: res.headers };
  }

  get<T = any>(path: string, headers?: Record<string, string>) {
    return this.request<T>("GET", path, undefined, headers);
  }
  post<T = any>(path: string, body: unknown = {}, headers?: Record<string, string>) {
    return this.request<T>("POST", path, body, headers);
  }
  put<T = any>(path: string, body: unknown) {
    return this.request<T>("PUT", path, body);
  }
  patch<T = any>(path: string, body: unknown) {
    return this.request<T>("PATCH", path, body);
  }
  delete<T = any>(path: string) {
    return this.request<T>("DELETE", path);
  }
}

export function randomIp(): string {
  return `10.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
}

export async function login(email: string, password: string): Promise<Session> {
  const session = new Session();
  const res = await session.post("/api/auth/login", { email, password });
  if (res.status !== 200) throw new Error(`Login falló para ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return session;
}

export const loginAdmin = () => login(ADMIN.email, ADMIN.password);

export function uniq(): string {
  return randomUUID().slice(0, 8);
}

/** Documento único de prueba (empieza por 99 para distinguirlo). */
export function testDocument(): string {
  return `99${randomInt(10_000_000, 99_999_999)}`;
}

export function testPhone(): string {
  return `31${randomInt(10_000_000, 99_999_999)}`;
}

export function clientPayload(overrides: Record<string, unknown> = {}) {
  const id = uniq();
  return {
    fullName: `Prueba Cliente ${id.replace(/\d/g, "x")}`,
    document: testDocument(),
    phone: testPhone(),
    email: `cliente.${id}@${TEST_DOMAIN}`,
    plan: "three_days",
    monthlyFee: 130000,
    startDate: addDaysISO(todayISO(), -30),
    isActive: true,
    notes: null,
    schedule: [] as { weekday: number; slotId: number }[],
    ...overrides,
  };
}

export function trialPayload(overrides: Record<string, unknown> = {}) {
  const id = uniq();
  return {
    fullName: `Persona Prueba ${id.replace(/\d/g, "y")}`,
    document: testDocument(),
    phone: testPhone(),
    email: `trial.${id}@${TEST_DOMAIN}`,
    website: "",
    ...overrides,
  };
}

/** Fechas de referencia (siempre en el futuro/pasado sin importar el día). */
export function refDates() {
  const today = todayISO();
  const monday = startOfWeekISO(today);
  const nextMon = addDaysISO(monday, 7);
  return {
    today,
    yesterday: addDaysISO(today, -1),
    nextMon,
    nextTue: addDaysISO(nextMon, 1),
    nextWed: addDaysISO(nextMon, 2),
    nextThu: addDaysISO(nextMon, 3),
    nextFri: addDaysISO(nextMon, 4),
    nextSat: addDaysISO(nextMon, 5),
    nextNextMon: addDaysISO(nextMon, 7),
    lastMon: addDaysISO(monday, -7),
    lastTue: addDaysISO(monday, -6),
    lastWed: addDaysISO(monday, -5),
  };
}

/** Crea un cliente vía API y devuelve su id. */
export async function createClient(admin: Session, overrides: Record<string, unknown> = {}) {
  const payload = clientPayload(overrides);
  const res = await admin.post<{ id: string }>("/api/admin/clients", payload);
  if (res.status !== 201) throw new Error(`No se creó el cliente: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: res.body.id, ...payload };
}

/** Clase de un día específico en la agenda del admin. */
export async function getClass(admin: Session, date: string, slotId: number) {
  const res = await admin.get(`/api/admin/agenda/day?date=${date}`);
  if (res.status !== 200) throw new Error(`Agenda falló: ${res.status}`);
  return (res.body.classes as Array<{ slotId: number; booked: number; capacity: number; attendees: any[] }>).find(
    (c) => c.slotId === slotId,
  );
}

/** Borra los datos creados por las pruebas (por dominio de correo). */
export async function cleanupTestData(sql: postgres.Sql) {
  const like = `%@${TEST_DOMAIN}`;
  await sql`delete from public.users where role = 'client' and email like ${like}`;
  await sql`delete from public.trials where email like ${like}`;
  await sql`delete from public.closed_days where reason = ${TEST_CLOSED_REASON}`;
  await sql`delete from public.class_plans where class_date = ${TEST_PLAN_DATE}::date`;
}
