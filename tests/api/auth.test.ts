import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createClient, login, loginAdmin, Session, TEST_DOMAIN, uniq, ADMIN } from "./helpers";

const slotId = inject("testSlotId");
const schedule = [1, 3, 5].map((weekday) => ({ weekday, slotId }));

describe("autenticación y sesiones", () => {
  let admin: Session;
  const created: string[] = [];

  beforeAll(async () => {
    admin = await loginAdmin();
  });

  afterAll(async () => {
    for (const id of created) await admin.delete(`/api/admin/clients/${id}`);
  });

  it("rechaza credenciales inválidas sin revelar si el correo existe", async () => {
    const s = new Session();
    const unknown = await s.post("/api/auth/login", { email: `nadie.${uniq()}@${TEST_DOMAIN}`, password: "x" });
    const wrong = await s.post("/api/auth/login", { email: ADMIN.email, password: "incorrecta" });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it("valida el formato de los datos de acceso", async () => {
    const res = await new Session().post("/api/auth/login", { email: "no-es-correo", password: "" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("el admin inicia sesión con cookies httpOnly", async () => {
    const s = new Session();
    const res = await s.post("/api/auth/login", { email: "  BoxHouseSeven.Tech@Gmail.com ", password: ADMIN.password });
    expect(res.status).toBe(200);
    expect(res.body.redirectTo).toBe("/admin/agenda");
    const cookies = res.headers.getSetCookie();
    const access = cookies.find((c) => c.startsWith("bh7_at="))!;
    const refresh = cookies.find((c) => c.startsWith("bh7_rt="))!;
    const expiry = cookies.find((c) => c.startsWith("bh7_exp="))!;
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=lax/i);
    expect(refresh).toMatch(/HttpOnly/i);
    expect(expiry).not.toMatch(/HttpOnly/i);
    const me = await s.get("/api/auth/me");
    expect(me.body.user).toMatchObject({ role: "admin", email: ADMIN.email });
  });

  it("el cliente inicia sesión con su documento (también escrito con puntos)", async () => {
    const c = await createClient(admin, { schedule });
    created.push(c.id);
    const plain = await new Session().post("/api/auth/login", { email: c.email, password: c.document });
    expect(plain.status).toBe(200);
    expect(plain.body.redirectTo).toBe("/agenda");
    const dotted = c.document.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3.$4");
    const withDots = await new Session().post("/api/auth/login", { email: c.email.toUpperCase(), password: dotted });
    expect(withDots.status).toBe(200);
  });

  it("cliente inactivo: con la clave correcta recibe ACCOUNT_INACTIVE (para mostrar el modal)", async () => {
    const c = await createClient(admin, { schedule, isActive: false });
    created.push(c.id);
    const ok = await new Session().post("/api/auth/login", { email: c.email, password: c.document });
    expect(ok.status).toBe(403);
    expect(ok.body.error.code).toBe("ACCOUNT_INACTIVE");
    const bad = await new Session().post("/api/auth/login", { email: c.email, password: "0000" });
    expect(bad.status).toBe(401);
  });

  it("protege la API y las páginas según el rol", async () => {
    const anon = new Session();
    const c = await createClient(admin, { schedule });
    created.push(c.id);
    const client = await login(c.email, c.document);

    expect((await anon.get("/api/admin/settings")).status).toBe(401);
    expect((await anon.get("/api/me/agenda")).status).toBe(401);
    expect((await client.get("/api/admin/settings")).status).toBe(403);
    expect((await client.get("/api/admin/clients")).status).toBe(403);
    expect((await admin.get("/api/me/profile")).status).toBe(403);

    const page = await anon.get("/admin/agenda");
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/login?next=%2Fadmin%2Fagenda");
    expect((await client.get("/admin/clientes")).headers.get("location")).toMatch(/\/agenda$/);
    expect((await admin.get("/agenda")).headers.get("location")).toMatch(/\/admin\/agenda$/);
    expect((await admin.get("/login")).headers.get("location")).toMatch(/\/admin\/agenda$/);
    expect((await client.get("/")).headers.get("location")).toMatch(/\/agenda$/);
    expect((await anon.get("/")).headers.get("location")).toMatch(/\/login$/);
    // Rutas públicas
    expect((await anon.get("/api/public/availability")).status).toBe(200);
    expect((await anon.get("/clase-de-prueba")).status).toBe(200);
  });

  it("renueva el access token y rota el refresh token (con margen para pestañas paralelas)", async () => {
    const s = await loginAdmin();
    const oldRefresh = s.cookies.get("bh7_rt")!;
    const oldAccess = s.cookies.get("bh7_at")!;

    const first = await s.post("/api/auth/refresh");
    expect(first.status).toBe(200);
    expect(s.cookies.get("bh7_rt")).not.toBe(oldRefresh);
    expect(s.cookies.get("bh7_at")).not.toBe(oldAccess);

    // Otra pestaña llega con el refresh anterior casi al mismo tiempo.
    const tab = new Session();
    tab.cookies.set("bh7_rt", oldRefresh);
    const parallel = await tab.post("/api/auth/refresh");
    expect(parallel.status).toBe(200);
    expect(parallel.headers.getSetCookie().some((c) => c.startsWith("bh7_rt="))).toBe(false);
    expect((await tab.get("/api/admin/settings")).status).toBe(200);
  });

  it("el proxy renueva la sesión de forma transparente si expiró el access token", async () => {
    const s = await loginAdmin();
    s.cookies.delete("bh7_at");
    const res = await s.get("/api/admin/settings");
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().some((c) => c.startsWith("bh7_at="))).toBe(true);
    // También al navegar a una página protegida.
    s.cookies.delete("bh7_at");
    const page = await s.get("/admin/agenda");
    expect(page.status).toBe(200);
  });

  it("cerrar sesión invalida el access token y el refresh token", async () => {
    const s = await loginAdmin();
    const stolen = new Session();
    for (const [k, v] of s.cookies) stolen.cookies.set(k, v);

    expect((await s.post("/api/auth/logout")).status).toBe(200);
    expect(s.cookies.size).toBe(0);

    const reuseAccess = new Session();
    reuseAccess.cookies.set("bh7_at", stolen.cookies.get("bh7_at")!);
    expect((await reuseAccess.get("/api/admin/settings")).status).toBe(401);

    const reuseRefresh = new Session();
    reuseRefresh.cookies.set("bh7_rt", stolen.cookies.get("bh7_rt")!);
    const r = await reuseRefresh.post("/api/auth/refresh");
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("SESSION_INVALID");
  });

  it("inactivar a un cliente le cierra el acceso de inmediato", async () => {
    const c = await createClient(admin, { schedule });
    created.push(c.id);
    const client = await login(c.email, c.document);
    expect((await client.get("/api/me/agenda")).status).toBe(200);

    expect((await admin.patch(`/api/admin/clients/${c.id}/status`, { isActive: false })).status).toBe(200);
    expect((await client.get("/api/me/agenda")).status).toBe(401);
    const refresh = await client.post("/api/auth/refresh");
    expect(refresh.status).toBe(403);
    expect(refresh.body.error.code).toBe("ACCOUNT_INACTIVE");
  });

  it("cambiar el documento cambia la contraseña y cierra las sesiones abiertas", async () => {
    const c = await createClient(admin, { schedule });
    created.push(c.id);
    const client = await login(c.email, c.document);
    const detail = (await admin.get(`/api/admin/clients/${c.id}`)).body;
    const newDocument = `98${c.document.slice(2)}`;
    const update = await admin.put(`/api/admin/clients/${c.id}`, {
      ...c,
      document: newDocument,
      schedule: detail.schedule.map((s: { weekday: number; slotId: number }) => ({ weekday: s.weekday, slotId: s.slotId })),
    });
    expect(update.status).toBe(200);
    expect((await client.get("/api/me/agenda")).status).toBe(401);
    expect((await new Session().post("/api/auth/login", { email: c.email, password: c.document })).status).toBe(401);
    expect((await new Session().post("/api/auth/login", { email: c.email, password: newDocument })).status).toBe(200);
  });

  it("bloquea ataques de fuerza bruta (8 intentos fallidos por cuenta)", async () => {
    const s = new Session();
    const email = `fuerza.${uniq()}@${TEST_DOMAIN}`;
    for (let i = 0; i < 8; i++) {
      expect((await s.post("/api/auth/login", { email, password: `x${i}` })).status).toBe(401);
    }
    const blocked = await s.post("/api/auth/login", { email, password: "otra" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });

  it("rechaza escrituras desde otro origen (CSRF)", async () => {
    const res = await admin.post("/api/admin/classes/add", {}, { origin: "https://sitio-malicioso.com" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("rechaza tokens manipulados", async () => {
    const s = await loginAdmin();
    const token = s.cookies.get("bh7_at")!;
    const [h, p, sig] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), role: "admin", sub: "otro" }),
    ).toString("base64url");
    const forged = new Session();
    forged.cookies.set("bh7_at", `${h}.${forgedPayload}.${sig}`);
    expect((await forged.get("/api/admin/settings")).status).toBe(401);
  });
});
