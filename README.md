# Boxhouseseven · Agenda y gestión de clases

Aplicación web 100 % responsive para el gimnasio de boxeo **Boxhouseseven** (Cartago, Valle del Cauca):
agenda de clases con asistencia, clientes con mensualidad y horario, reagendamiento dentro de la semana,
clases de prueba con enlace público y planificación diaria de entrenamientos.

---

## Puesta en marcha

Requisitos: **Node v24.11.1** y **npm 11.6.2**.

```bash
npm install
npm run dev
```

Abrir <http://localhost:3000>.

El archivo `.env.local` ya viene configurado con el proyecto de Supabase y la base de datos ya tiene las
migraciones aplicadas. Si se parte de un proyecto nuevo de Supabase:

```bash
cp .env.example .env.local   # completar la clave de la BD y generar secretos
npm run db:migrate           # crea tablas, funciones, índices, RLS, el rol de la app y el admin
npm run db:demo              # (opcional) datos de demostración
```

### Accesos

| Rol | Usuario | Contraseña |
| --- | --- | --- |
| Administrador | `boxhouseseven.tech@gmail.com` | `123456` |
| Cliente | su correo | **su número de documento** (se acepta con o sin puntos) |

- Enlace público de clase de prueba (para redes sociales): **`/clase-de-prueba`**. También está en
  *Clases de prueba* con botones para copiarlo y descargar un **código QR**.
- Hay **datos de demostración** cargados (44 clientes, pruebas, asistencias y planes) con correos
  `@demo.bh7.test`. Ejemplo: `anamaria.torres@demo.bh7.test` / `1111592160`.
  Para borrarlos: `npm run db:demo:clear` (no toca datos reales ni configuración).

---

## Funcionalidades

### Administrador

- **Agenda** (pantalla principal): vista de **día** tipo línea de tiempo (mañana / tarde), con ocupación
  `5/7` por clase, vista previa de asistentes, estado *en curso / finalizada / en 2 h* y plan
  del día. Vista de **semana** con mapa de ocupación. Navegación ← →, "Hoy", **"Ir a fecha"** (calendario) y
  atajos de teclado (← → H).
  - Detalle de clase: lista completa con etiquetas *Prueba*, *Reagendado (desde…)*, *Agregado*, plan e
    inactivo; contacto por WhatsApp/llamada/correo; **asistencia** (Asistió / Faltó, o todos a la vez);
    **agregar** un cliente a la clase (sin límite de cupo, opcionalmente marcándolo como asistente) y
    **quitarlo** solo de esa fecha.
- **Clientes**: búsqueda por nombre (sin tildes), documento, celular o correo; filtros por estado y plan;
  orden; **paginación**. Crear, editar (cualquier dato, incluida la modalidad), activar/inactivar y
  eliminar. Detalle con contacto, mensualidad (modalidad, valor y fecha de inicio), horario semanal, próximas
  clases e **historial de asistencia** por mes. *Por ahora la app no gestiona pagos.*
  - Editor de horario: plan de 3 días (exactamente 3 días) o diario (lunes a viernes), misma hora o una
    distinta por día, mostrando cuántos clientes ya tiene cada franja y avisando si se supera el cupo.
- **Clases de prueba**: enlace público + QR, filtros (agendadas, asistieron, no asistieron, convertidas,
  canceladas; próximas/pasadas), asistencia, editar/reagendar, cancelar, eliminar, agendar manualmente y
  **convertir a cliente** (asignando modalidad, mensualidad y días).
- **Planificación**: calendario mensual con vista previa; editor por día con atajos de bloques
  (Calentamiento, Técnica, Saco…), guardado con Ctrl+S y guardado automático al cambiar de día.
- **Configuración**: horarios de clase (crear, editar, eliminar, días en que aplican), cupo máximo por clase,
  antelación mínima para reagendar/agendar, días visibles para pruebas, precios de los planes, WhatsApp y
  dirección; **días cerrados** con carga en un clic de los **festivos de Colombia** (Ley Emiliani).

### Cliente

- **Mi agenda**: semana con sus clases (estado, asistencia, origen), tarjeta de *próxima clase* y navegación
  entre semanas. **Reagendar**: elige otro día/hora de la **misma semana** con cupo (solo ve cupos, nunca
  quién asiste).
- **Historial**: asistencias y faltas por mes con porcentaje de cumplimiento.
- **Perfil**: datos personales, modalidad, mensualidad y días de asistencia en **solo lectura**.
- Si la cuenta está **inactiva**, al iniciar sesión (o durante la sesión) aparece un modal indicando que debe
  hablar con el administrador (con botón de WhatsApp si está configurado).

### Clase de prueba (público)

1. Datos (nombre, documento, celular, correo) → se valida que **no sea cliente ni haya agendado antes**.
2. Calendario con los días y horarios disponibles mostrando **solo cupos**.
3. Confirmación con los datos de la clase, lo que debe llevar (**agua, toalla y ropa deportiva**) y botón para
   agregarla a Google Calendar.

---

## Reglas de negocio

- La asistencia esperada de cada clase se **calcula** (no se materializa): horario semanal de clientes
  activos desde su fecha de inicio + cambios puntuales (reagendamientos y ajustes del admin) + clases de
  prueba. Los clientes **inactivos no cuentan** en ninguna clase.
- Cupo máximo configurable (7 por defecto). Aplica a **reagendamientos** y **pruebas públicas**; el admin
  puede superarlo desde la agenda.
- Reagendar: solo dentro de la misma semana (lunes a domingo), con cupo, máximo una clase por día, hasta N
  minutos antes de que empiece la clase de origen y la de destino (60 por defecto). Mover la clase de vuelta
  a su día original restaura el horario base. Si el día está cerrado (festivo), la clase se puede mover a otro
  día de la semana.
- Si el admin cambia el horario base de un cliente, sus reagendamientos pendientes se reinician.
- Una persona solo puede tener **una** clase de prueba (por documento o correo). Si se crea como cliente a
  alguien que había agendado prueba, la prueba queda marcada como convertida.
- La contraseña del cliente es su documento: si el admin cambia el documento, cambia la contraseña y se
  cierran sus sesiones.
- Todas las fechas y horas se manejan en **hora de Colombia (America/Bogota)**, sin importar dónde corra el
  servidor.

---

## Arquitectura

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16.4 (App Router, Turbopack, Cache Components), React 19.3, TypeScript |
| API | **Route Handlers** (`src/app/api/**`) + **Proxy** (`src/proxy.ts`, antes *middleware*) |
| Base de datos | **Supabase Postgres** vía pooler (modo transacción) con `postgres` (postgres.js) |
| Autenticación | JWT propios (HS256, `jose`) + refresh tokens rotativos; contraseñas con **bcrypt** |
| UI | Tailwind CSS v4, shadcn/ui (Radix), lucide-react, sonner; tipografías Barlow / Barlow Condensed |
| Estado | TanStack Query (estado del servidor) + estado en la URL (fecha, vista, filtros, página) |
| Formularios | react-hook-form + zod (mismos esquemas en cliente y servidor) |

```
src/
  app/                 páginas (admin, (cliente), login, clase-de-prueba) y API (route handlers)
  proxy.ts             protección por rol + renovación transparente de sesión + chequeo de origen (CSRF)
  server/              solo servidor: db, auth (JWT, sesiones, cookies), servicios de dominio, http helpers
  lib/                 compartido: esquemas zod, fechas (Bogotá), tipos, errores, formato, festivos
  hooks/               hooks de datos (TanStack Query) y de estado en URL
  components/          UI por módulo (agenda, clients, trials, plans, settings, me, public, common, ui)
supabase/migrations/   esquema SQL (tablas, índices, funciones, RLS)
scripts/               migraciones y datos demo
tests/                 pruebas unitarias y de integración de la API
```

**Notas sobre los requerimientos técnicos**

- *Edge functions*: en Next.js 16.4 el *Edge Runtime* está **deprecado** para rutas y el Proxy corre en
  Node.js. Por eso el backend está en Route Handlers y la validación del JWT en el Proxy usa solo Web Crypto
  (`jose`), compatible con Edge.
- *Supabase*: la app no usa `supabase-js` con la clave publicable porque la autenticación es propia (JWT
  pedido en el requerimiento) y exponer las tablas a la clave pública obligaría a abrir datos de clientes. En
  su lugar, el servidor de Next.js se conecta a Postgres de Supabase con un **rol de mínimo privilegio**
  (`bh7_app`). Las tablas tienen **RLS activado** y los roles públicos (`anon`, `authenticated`) no tienen
  acceso: la Data API responde *permission denied* (verificado). Los *advisors* de seguridad de Supabase no
  reportan problemas.

### Seguridad

- Access token de **15 minutos** (cookie httpOnly) + refresh token de **30 días** (httpOnly, guardado como
  hash SHA-256) que **rota** en cada renovación, con margen de 30 s para pestañas paralelas.
- **Renovación automática**: el navegador renueva ~2 min antes de expirar (y al volver a la pestaña,
  coordinado entre pestañas con Web Locks); si aun así expiró, el Proxy la renueva en la misma petición.
- **Cerrar sesión** revoca la sesión en BD: el refresh deja de servir y los access tokens emitidos se rechazan
  de inmediato (cada token lleva el id de sesión). Inactivar un cliente también corta su acceso.
- Límite de intentos fallidos de login (8 por cuenta / 40 por IP en 15 min), límite en el formulario público
  y campo trampa anti-bots. Rechazo de escrituras desde otro origen (CSRF) y cabeceras de seguridad.
- Cada Route Handler valida rol y datos (zod) aunque el Proxy ya filtre.

### Rendimiento

- El cálculo de asistentes es una función SQL (`class_entries`) sobre índices específicos
  (`client_schedules(weekday, slot_id)`, excepciones por fecha, pruebas por clase); un día o una semana completa
  se resuelve en **una consulta** de pocos milisegundos.
- Las operaciones críticas (agendar prueba, reagendar, agregar/quitar de clase) son funciones SQL atómicas en
  **un solo viaje** a la BD, con *advisory locks* por clase para que dos personas no tomen el último cupo
  (probado con solicitudes simultáneas).
- Consultas independientes en paralelo, configuración y horarios en caché de memoria del servidor (se invalida
  al guardar cambios), caché en el cliente con TanStack Query, **precarga** del día anterior/siguiente
  y navegación por fechas sin ir al servidor (estado en la URL).

---

## Pruebas

```bash
npm run test:unit   # lógica de fechas/zona horaria, festivos, validaciones, errores (no requiere servidor)
npm run test:api    # integración contra la API real: requiere `npm run dev` en otra terminal
npm test            # ambas
npm run lint
npm run typecheck
```

Las pruebas de API (56 casos) crean sus propios datos con correos `@test.bh7.test` y una franja exclusiva de
22:00 a 23:00, y **los eliminan al terminar**. Cubren, por rol y con casos borde:

- Login (admin y cliente, documento con puntos, cliente inactivo, credenciales erróneas, fuerza bruta),
  protección por rol de API y páginas, rotación y reutilización de refresh tokens, renovación vía Proxy,
  revocación al cerrar sesión, tokens manipulados y CSRF.
- Clientes: validación de horario por plan, duplicados, búsqueda sin tildes, filtros, paginación, edición,
  estado, eliminación y vinculación automática con su clase de prueba.
- Agenda: cálculo de asistentes (inactivos, fecha de inicio), agregar/quitar, sobrecupo del admin,
  asistencia (futura, pasada, masiva), clientes inactivos que asistieron, días cerrados y planificación.
- Clases de prueba: verificación previa, disponibilidad sin datos personales, duplicados, bots, clases
  inexistentes/pasadas/cerradas/fuera de ventana, cupo lleno, **concurrencia por el último cupo**, gestión del
  admin y conversión a cliente.
- Reagendamiento: misma semana, un día con clase, misma clase, clase inexistente o pasada, cupo, regreso al
  horario original, días cerrados, reinicio al cambiar el horario base y privacidad.
- Configuración: validaciones, efecto inmediato del cupo, franjas (solapamiento, en uso), días cerrados y
  que una petición cancelada durante la recarga de la caché no bloquee a las siguientes.

Resultado de la última ejecución: **95 pruebas en verde** (39 unitarias + 56 de API), `lint`, `typecheck` y
`next build` sin errores.

---

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilación y servidor de producción |
| `npm run db:migrate` | Aplica `supabase/migrations/*.sql` y crea/actualiza el rol `bh7_app` |
| `npm run db:demo` | Carga datos de demostración (`-- --reset` para recrearlos) |
| `npm run db:demo:clear` | Borra los datos de demostración |
| `npm test`, `test:unit`, `test:api` | Pruebas |
| `npm run lint`, `npm run typecheck` | Calidad de código |

## Recomendaciones antes de usarla con clientes reales

1. En **Configuración**, cargar los **festivos de Colombia** (el lunes 12 de octubre es festivo) y registrar el
   **WhatsApp** y la **dirección** del gimnasio.
2. Borrar los datos demo con `npm run db:demo:clear`.
3. Cambiar la contraseña del administrador por defecto si la app se publica (hoy no hay flujo de cambio de
   clave por requerimiento; se puede actualizar el hash en la tabla `users`).
# boxhouseseven
