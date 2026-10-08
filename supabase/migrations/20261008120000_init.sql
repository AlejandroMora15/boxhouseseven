-- =============================================================================
-- Boxhouseseven · Esquema inicial
--
-- Modelo:
--   * users / clients       → identidad (login) y perfil de cliente.
--   * client_schedules      → horario semanal por defecto (día ISO + franja).
--   * schedule_exceptions   → cambios puntuales por fecha (reagendamientos y
--                             ajustes del admin): 'add' agrega al cliente a una
--                             clase, 'remove' lo quita de su clase habitual.
--   * attendance            → asistencia marcada por el admin.
--   * trials                → clases de prueba (tabla independiente).
--
-- La asistencia esperada de cada clase NO se materializa: se calcula al vuelo
-- con public.class_entries() (horario base + excepciones + pruebas). Eso evita
-- jobs de generación y mantiene las consultas en un solo viaje a la BD.
--
-- Todas las fechas de clase se interpretan en America/Bogota (UTC-5, sin DST).
-- El rol de aplicación bh7_app lo crea scripts/db-migrate.mjs antes de correr
-- este archivo (necesita contraseña, que no debe vivir en el repositorio).
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Fecha "hoy" en Colombia (la BD corre en UTC).
create or replace function public.bogota_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Bogota')::date
$$;

-- -----------------------------------------------------------------------------
-- Usuarios (admin y clientes comparten login)
-- -----------------------------------------------------------------------------

create table public.users (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('admin', 'client')),
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  password_hash text not null,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index users_email_key on public.users (email);
create trigger users_set_updated_at before update on public.users
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Franjas horarias configurables
-- -----------------------------------------------------------------------------

create table public.time_slots (
  id integer generated always as identity primary key,
  start_time time not null,
  end_time time not null,
  weekdays smallint[] not null default '{1,2,3,4,5}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_slots_range_chk check (end_time > start_time),
  constraint time_slots_weekdays_chk check (
    cardinality(weekdays) between 1 and 7
    and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]
  )
);

create index time_slots_active_idx on public.time_slots (start_time) where is_active;
create trigger time_slots_set_updated_at before update on public.time_slots
  for each row execute function private.set_updated_at();

-- Dos franjas activas no pueden solaparse en un mismo día de la semana.
create or replace function private.check_time_slot_overlap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_active and exists (
    select 1
    from public.time_slots t
    where t.is_active
      and t.id <> new.id
      and t.weekdays && new.weekdays
      and t.start_time < new.end_time
      and new.start_time < t.end_time
  ) then
    raise exception 'SLOT_OVERLAP' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger time_slots_check_overlap before insert or update on public.time_slots
  for each row execute function private.check_time_slot_overlap();

-- -----------------------------------------------------------------------------
-- Configuración general (fila única)
-- -----------------------------------------------------------------------------

create table public.settings (
  id boolean primary key default true check (id),
  max_per_class smallint not null default 7 check (max_per_class between 1 and 100),
  price_three_days integer not null default 130000 check (price_three_days >= 0),
  price_daily integer not null default 150000 check (price_daily >= 0),
  booking_cutoff_minutes smallint not null default 60 check (booking_cutoff_minutes between 0 and 1440),
  trial_window_days smallint not null default 14 check (trial_window_days between 1 and 90),
  whatsapp_phone text check (whatsapp_phone is null or whatsapp_phone ~ '^\+?[0-9]{7,15}$'),
  address text check (address is null or char_length(address) <= 200),
  updated_at timestamptz not null default now()
);

create trigger settings_set_updated_at before update on public.settings
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Clientes
-- -----------------------------------------------------------------------------

create table public.clients (
  user_id uuid primary key references public.users (id) on delete cascade,
  document text not null check (document ~ '^[0-9A-Z]{4,20}$'),
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  plan text not null check (plan in ('three_days', 'daily')),
  monthly_fee integer not null check (monthly_fee >= 0),
  start_date date not null,
  next_payment_date date,
  notes text check (notes is null or char_length(notes) <= 1000),
  -- Texto normalizado (sin tildes, minúsculas) para búsquedas rápidas.
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index clients_document_key on public.clients (document);
create index clients_search_trgm_idx on public.clients using gin (search_text extensions.gin_trgm_ops);
create trigger clients_set_updated_at before update on public.clients
  for each row execute function private.set_updated_at();

create table public.client_schedules (
  client_id uuid not null references public.clients (user_id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  slot_id integer not null references public.time_slots (id),
  primary key (client_id, weekday)
);

-- Índice principal del cálculo de agenda: (día de semana, franja) → clientes.
create index client_schedules_weekday_slot_idx
  on public.client_schedules (weekday, slot_id) include (client_id);
create index client_schedules_slot_idx on public.client_schedules (slot_id);

create table public.schedule_exceptions (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.clients (user_id) on delete cascade,
  class_date date not null,
  slot_id integer not null references public.time_slots (id),
  kind text not null check (kind in ('add', 'remove')),
  source text not null check (source in ('reschedule', 'admin')),
  -- Une el 'remove' de la clase original con el 'add' de la nueva.
  reschedule_group uuid,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index schedule_exceptions_class_key
  on public.schedule_exceptions (client_id, class_date, slot_id);
create index schedule_exceptions_date_idx
  on public.schedule_exceptions (class_date, slot_id) include (client_id, kind, source);
create index schedule_exceptions_slot_idx on public.schedule_exceptions (slot_id);
create index schedule_exceptions_created_by_idx on public.schedule_exceptions (created_by);
create index schedule_exceptions_group_idx on public.schedule_exceptions (reschedule_group)
  where reschedule_group is not null;

create table public.attendance (
  class_date date not null,
  slot_id integer not null references public.time_slots (id),
  client_id uuid not null references public.clients (user_id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  marked_by uuid references public.users (id) on delete set null,
  marked_at timestamptz not null default now(),
  primary key (class_date, slot_id, client_id)
);

create index attendance_client_idx on public.attendance (client_id, class_date desc);
create index attendance_slot_idx on public.attendance (slot_id);
create index attendance_marked_by_idx on public.attendance (marked_by);

-- -----------------------------------------------------------------------------
-- Clases de prueba
-- -----------------------------------------------------------------------------

create table public.trials (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  document text not null check (document ~ '^[0-9A-Z]{4,20}$'),
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  class_date date not null,
  slot_id integer not null references public.time_slots (id),
  status text not null default 'scheduled' check (status in ('scheduled', 'converted', 'cancelled')),
  attendance text check (attendance in ('present', 'absent')),
  source text not null default 'web' check (source in ('web', 'admin')),
  notes text check (notes is null or char_length(notes) <= 1000),
  converted_client_id uuid references public.clients (user_id) on delete set null,
  converted_at timestamptz,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una persona solo puede agendar una clase de prueba en la vida.
create unique index trials_document_key on public.trials (document);
create unique index trials_email_key on public.trials (email);
create index trials_class_idx on public.trials (class_date, slot_id) where status <> 'cancelled';
create index trials_slot_idx on public.trials (slot_id);
create index trials_converted_client_idx on public.trials (converted_client_id);
create index trials_created_idx on public.trials (created_at desc);
create index trials_search_trgm_idx on public.trials using gin (search_text extensions.gin_trgm_ops);
create trigger trials_set_updated_at before update on public.trials
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Planificación de clases (por día) y días cerrados
-- -----------------------------------------------------------------------------

create table public.class_plans (
  class_date date primary key,
  content text not null check (char_length(content) <= 5000),
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index class_plans_updated_by_idx on public.class_plans (updated_by);
create trigger class_plans_set_updated_at before update on public.class_plans
  for each row execute function private.set_updated_at();

create table public.closed_days (
  day date primary key,
  reason text not null check (char_length(btrim(reason)) between 2 and 120),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Sesiones (refresh tokens rotativos, guardados como hash SHA-256)
-- -----------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  refresh_hash text not null,
  prev_refresh_hash text,
  rotated_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text,
  ip text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create unique index sessions_refresh_hash_key on public.sessions (refresh_hash);
create index sessions_prev_refresh_hash_idx on public.sessions (prev_refresh_hash)
  where prev_refresh_hash is not null;
create index sessions_user_idx on public.sessions (user_id);
create index sessions_expires_idx on public.sessions (expires_at);

-- =============================================================================
-- Funciones de dominio
-- =============================================================================

-- Asistentes esperados/registrados de cada clase en un rango de fechas.
-- Incluye: horario base de clientes activos (desde su fecha de inicio) menos
-- las clases removidas, más las agregadas, más las asistencias marcadas (para
-- conservar el historial aunque el cliente se inactive) y las clases de prueba.
create or replace function public.class_entries(
  p_from date,
  p_to date,
  p_client_id uuid default null
)
returns table (
  class_date date,
  slot_id integer,
  entry_type text,
  person_id uuid,
  origin text,
  attendance text,
  reschedule_group uuid
)
language sql
stable
set search_path = ''
as $$
  with days as (
    select g.d::date as class_date, extract(isodow from g.d)::smallint as dow
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as g(d)
  ),
  scheduled as (
    select dy.class_date, cs.slot_id, cs.client_id, 'schedule'::text as origin, null::uuid as reschedule_group
    from days dy
    join public.client_schedules cs on cs.weekday = dy.dow
    join public.clients c on c.user_id = cs.client_id
    join public.users u on u.id = cs.client_id
    where u.is_active
      and c.start_date <= dy.class_date
      and (p_client_id is null or cs.client_id = p_client_id)
      and not exists (
        select 1
        from public.schedule_exceptions se
        where se.client_id = cs.client_id
          and se.class_date = dy.class_date
          and se.slot_id = cs.slot_id
          and se.kind = 'remove'
      )
    union all
    select se.class_date, se.slot_id, se.client_id, se.source, se.reschedule_group
    from public.schedule_exceptions se
    join public.users u on u.id = se.client_id
    where se.kind = 'add'
      and u.is_active
      and se.class_date between p_from and p_to
      and (p_client_id is null or se.client_id = p_client_id)
  ),
  marked as (
    select a.class_date, a.slot_id, a.client_id, a.status
    from public.attendance a
    where a.class_date between p_from and p_to
      and (p_client_id is null or a.client_id = p_client_id)
  )
  select
    coalesce(s.class_date, m.class_date),
    coalesce(s.slot_id, m.slot_id),
    'client'::text,
    coalesce(s.client_id, m.client_id),
    coalesce(s.origin, 'attendance'),
    m.status,
    s.reschedule_group
  from scheduled s
  full join marked m
    on m.class_date = s.class_date
   and m.slot_id = s.slot_id
   and m.client_id = s.client_id
  union all
  select t.class_date, t.slot_id, 'trial'::text, t.id, 'trial'::text, t.attendance, null::uuid
  from public.trials t
  where p_client_id is null
    and t.status <> 'cancelled'
    and t.class_date between p_from and p_to
$$;

-- Grilla de clases (fecha × franja) con cupos ocupados. Solo devuelve conteos,
-- nunca nombres: es la base de la disponibilidad pública.
create or replace function public.class_grid(p_from date, p_to date)
returns table (
  class_date date,
  slot_id integer,
  start_time time,
  end_time time,
  starts_at timestamptz,
  closed_reason text,
  booked integer,
  trials integer,
  capacity integer
)
language sql
stable
set search_path = ''
as $$
  with days as (
    select g.d::date as class_date, extract(isodow from g.d)::smallint as dow
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as g(d)
  ),
  counts as (
    select e.class_date, e.slot_id,
           count(*)::integer as booked,
           (count(*) filter (where e.entry_type = 'trial'))::integer as trials
    from public.class_entries(p_from, p_to) e
    group by e.class_date, e.slot_id
  ),
  keys as (
    select dy.class_date, ts.id as slot_id
    from days dy
    join public.time_slots ts on ts.is_active and dy.dow = any (ts.weekdays)
    union
    select c.class_date, c.slot_id from counts c
  )
  select
    k.class_date,
    k.slot_id,
    ts.start_time,
    ts.end_time,
    (k.class_date + ts.start_time) at time zone 'America/Bogota',
    cd.reason,
    coalesce(c.booked, 0),
    coalesce(c.trials, 0),
    (select s.max_per_class from public.settings s where s.id)::integer
  from keys k
  join public.time_slots ts on ts.id = k.slot_id
  left join public.closed_days cd on cd.day = k.class_date
  left join counts c on c.class_date = k.class_date and c.slot_id = k.slot_id
  order by k.class_date, ts.start_time
$$;

-- ¿La persona ya existe como cliente o ya agendó una clase de prueba?
-- Devuelve 'client', 'trial' o null.
create or replace function public.registration_status(
  p_document text,
  p_email text,
  p_exclude_trial uuid default null
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when exists (select 1 from public.clients c where c.document = upper(btrim(p_document)))
      or exists (select 1 from public.users u where u.email = lower(btrim(p_email)))
      then 'client'
    when exists (
      select 1 from public.trials t
      where (t.document = upper(btrim(p_document)) or t.email = lower(btrim(p_email)))
        and t.id is distinct from p_exclude_trial
    )
      then 'trial'
  end
$$;

-- Hora de inicio de una clase si la franja existe y aplica ese día.
create or replace function public.class_starts_at(p_class_date date, p_slot_id integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (p_class_date + ts.start_time) at time zone 'America/Bogota'
  from public.time_slots ts
  where ts.id = p_slot_id
    and ts.is_active
    and extract(isodow from p_class_date)::smallint = any (ts.weekdays)
$$;

create or replace function public.class_booked_count(p_class_date date, p_slot_id integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.class_entries(p_class_date, p_class_date) e
  where e.slot_id = p_slot_id
$$;

-- Agenda una clase de prueba de forma atómica (bloqueo por clase para que dos
-- personas no tomen el último cupo al mismo tiempo).
-- p_source = 'admin' omite cupo, ventana y antelación mínima.
create or replace function public.book_trial(
  p_full_name text,
  p_document text,
  p_phone text,
  p_email text,
  p_class_date date,
  p_slot_id integer,
  p_source text,
  p_search_text text,
  p_notes text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_settings public.settings%rowtype;
  v_starts_at timestamptz;
  v_id uuid;
begin
  select * into v_settings from public.settings where id;

  perform pg_advisory_xact_lock(hashtextextended('person:' || upper(btrim(p_document)), 0));

  if public.registration_status(p_document, p_email) is not null then
    raise exception 'ALREADY_REGISTERED' using errcode = 'P0001';
  end if;

  v_starts_at := public.class_starts_at(p_class_date, p_slot_id);
  if v_starts_at is null then
    raise exception 'INVALID_CLASS' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.closed_days cd where cd.day = p_class_date) then
    raise exception 'DAY_CLOSED' using errcode = 'P0001';
  end if;

  if p_source = 'web' then
    if v_starts_at - make_interval(mins => v_settings.booking_cutoff_minutes) <= now() then
      raise exception 'CLASS_TOO_SOON' using errcode = 'P0001';
    end if;
    if p_class_date > public.bogota_today() + v_settings.trial_window_days then
      raise exception 'OUT_OF_WINDOW' using errcode = 'P0001';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('class:' || p_class_date || ':' || p_slot_id, 0));
    if public.class_booked_count(p_class_date, p_slot_id) >= v_settings.max_per_class then
      raise exception 'CLASS_FULL' using errcode = 'P0001';
    end if;
  end if;

  insert into public.trials (
    full_name, document, phone, email, class_date, slot_id, source, notes, search_text
  )
  values (
    btrim(p_full_name), upper(btrim(p_document)), p_phone, lower(btrim(p_email)),
    p_class_date, p_slot_id, p_source, p_notes, p_search_text
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Reagenda una clase del cliente dentro de la misma semana (lun-dom),
-- validando cupo, antelación y que no tenga otra clase ese día.
create or replace function public.reschedule_class(
  p_client_id uuid,
  p_from_date date,
  p_from_slot integer,
  p_to_date date,
  p_to_slot integer
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_settings public.settings%rowtype;
  v_cutoff interval;
  v_from_origin text;
  v_from_group uuid;
  v_from_starts timestamptz;
  v_to_starts timestamptz;
  v_group uuid;
  v_removed bigint;
begin
  select * into v_settings from public.settings where id;
  v_cutoff := make_interval(mins => v_settings.booking_cutoff_minutes);

  if not exists (
    select 1 from public.users u where u.id = p_client_id and u.role = 'client' and u.is_active
  ) then
    raise exception 'CLIENT_INACTIVE' using errcode = 'P0001';
  end if;

  if p_from_date = p_to_date and p_from_slot = p_to_slot then
    raise exception 'SAME_CLASS' using errcode = 'P0001';
  end if;

  if date_trunc('week', p_from_date::timestamp) <> date_trunc('week', p_to_date::timestamp) then
    raise exception 'DIFFERENT_WEEK' using errcode = 'P0001';
  end if;

  -- Serializa las operaciones del mismo cliente.
  perform pg_advisory_xact_lock(hashtextextended('client:' || p_client_id, 0));

  select e.origin, e.reschedule_group into v_from_origin, v_from_group
  from public.class_entries(p_from_date, p_from_date, p_client_id) e
  where e.slot_id = p_from_slot and e.origin in ('schedule', 'reschedule', 'admin')
  limit 1;

  if v_from_origin is null then
    raise exception 'CLASS_NOT_FOUND' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.attendance a
    where a.client_id = p_client_id and a.class_date = p_from_date and a.slot_id = p_from_slot
  ) then
    raise exception 'ATTENDANCE_ALREADY_MARKED' using errcode = 'P0001';
  end if;

  select (p_from_date + ts.start_time) at time zone 'America/Bogota' into v_from_starts
  from public.time_slots ts where ts.id = p_from_slot;
  if v_from_starts - v_cutoff <= now() then
    raise exception 'FROM_TOO_LATE' using errcode = 'P0001';
  end if;

  v_to_starts := public.class_starts_at(p_to_date, p_to_slot);
  if v_to_starts is null then
    raise exception 'INVALID_CLASS' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.closed_days cd where cd.day = p_to_date) then
    raise exception 'DAY_CLOSED' using errcode = 'P0001';
  end if;
  if v_to_starts - v_cutoff <= now() then
    raise exception 'TO_TOO_LATE' using errcode = 'P0001';
  end if;

  -- Máximo una clase por día (sin contar la que se está moviendo).
  if exists (
    select 1
    from public.class_entries(p_to_date, p_to_date, p_client_id) e
    where e.origin in ('schedule', 'reschedule', 'admin')
      and not (e.class_date = p_from_date and e.slot_id = p_from_slot)
  ) then
    raise exception 'ALREADY_HAS_CLASS_THAT_DAY' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('class:' || p_to_date || ':' || p_to_slot, 0));
  if public.class_booked_count(p_to_date, p_to_slot) >= v_settings.max_per_class then
    raise exception 'CLASS_FULL' using errcode = 'P0001';
  end if;

  v_group := coalesce(v_from_group, gen_random_uuid());

  -- Liberar la clase de origen.
  if v_from_origin = 'schedule' then
    insert into public.schedule_exceptions (client_id, class_date, slot_id, kind, source, reschedule_group, created_by)
    values (p_client_id, p_from_date, p_from_slot, 'remove', 'reschedule', v_group, p_client_id);
  else
    delete from public.schedule_exceptions se
    where se.client_id = p_client_id
      and se.class_date = p_from_date
      and se.slot_id = p_from_slot
      and se.kind = 'add';
  end if;

  -- Ocupar la clase destino (si era su clase habitual, basta con restaurarla).
  delete from public.schedule_exceptions se
  where se.client_id = p_client_id
    and se.class_date = p_to_date
    and se.slot_id = p_to_slot
    and se.kind = 'remove'
  returning se.id into v_removed;

  if v_removed is null then
    insert into public.schedule_exceptions (client_id, class_date, slot_id, kind, source, reschedule_group, created_by)
    values (p_client_id, p_to_date, p_to_slot, 'add', 'reschedule', v_group, p_client_id);
  end if;

  return v_group;
end;
$$;

-- El admin agrega un cliente a una clase (sin límite de cupo).
create or replace function public.admin_add_to_class(
  p_admin_id uuid,
  p_client_id uuid,
  p_class_date date,
  p_slot_id integer,
  p_mark_present boolean
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_active boolean;
  v_in_class boolean;
  v_removed bigint;
begin
  select u.is_active into v_active
  from public.users u
  join public.clients c on c.user_id = u.id
  where u.id = p_client_id;

  if v_active is null then
    raise exception 'CLIENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not v_active and not p_mark_present then
    raise exception 'CLIENT_INACTIVE' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.time_slots ts
    where ts.id = p_slot_id and extract(isodow from p_class_date)::smallint = any (ts.weekdays)
  ) then
    raise exception 'INVALID_CLASS' using errcode = 'P0001';
  end if;
  if p_mark_present and p_class_date > public.bogota_today() then
    raise exception 'FUTURE_ATTENDANCE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('client:' || p_client_id, 0));

  select exists (
    select 1
    from public.class_entries(p_class_date, p_class_date, p_client_id) e
    where e.slot_id = p_slot_id and e.origin in ('schedule', 'reschedule', 'admin')
  ) into v_in_class;

  if not v_in_class then
    delete from public.schedule_exceptions se
    where se.client_id = p_client_id
      and se.class_date = p_class_date
      and se.slot_id = p_slot_id
      and se.kind = 'remove'
    returning se.id into v_removed;

    if v_removed is null then
      insert into public.schedule_exceptions (client_id, class_date, slot_id, kind, source, created_by)
      values (p_client_id, p_class_date, p_slot_id, 'add', 'admin', p_admin_id);
    end if;
  elsif not p_mark_present then
    raise exception 'ALREADY_IN_CLASS' using errcode = 'P0001';
  end if;

  if p_mark_present then
    insert into public.attendance (class_date, slot_id, client_id, status, marked_by)
    values (p_class_date, p_slot_id, p_client_id, 'present', p_admin_id)
    on conflict (class_date, slot_id, client_id)
    do update set status = 'present', marked_by = excluded.marked_by, marked_at = now();
  end if;
end;
$$;

-- El admin quita a un cliente de una clase puntual.
create or replace function public.admin_remove_from_class(
  p_admin_id uuid,
  p_client_id uuid,
  p_class_date date,
  p_slot_id integer
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_origin text;
begin
  perform pg_advisory_xact_lock(hashtextextended('client:' || p_client_id, 0));

  select e.origin into v_origin
  from public.class_entries(p_class_date, p_class_date, p_client_id) e
  where e.slot_id = p_slot_id
  limit 1;

  if v_origin is null then
    raise exception 'NOT_IN_CLASS' using errcode = 'P0001';
  end if;

  delete from public.attendance a
  where a.class_date = p_class_date and a.slot_id = p_slot_id and a.client_id = p_client_id;

  if v_origin = 'schedule' then
    insert into public.schedule_exceptions (client_id, class_date, slot_id, kind, source, created_by)
    values (p_client_id, p_class_date, p_slot_id, 'remove', 'admin', p_admin_id);
  elsif v_origin in ('reschedule', 'admin') then
    delete from public.schedule_exceptions se
    where se.client_id = p_client_id
      and se.class_date = p_class_date
      and se.slot_id = p_slot_id
      and se.kind = 'add';
  end if;
end;
$$;

-- Marca (o limpia, con p_status null) la asistencia de un cliente.
create or replace function public.set_attendance(
  p_admin_id uuid,
  p_client_id uuid,
  p_class_date date,
  p_slot_id integer,
  p_status text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_class_date > public.bogota_today() then
    raise exception 'FUTURE_ATTENDANCE' using errcode = 'P0001';
  end if;

  if p_status is null then
    delete from public.attendance a
    where a.class_date = p_class_date and a.slot_id = p_slot_id and a.client_id = p_client_id;
    return;
  end if;

  if not exists (
    select 1
    from public.class_entries(p_class_date, p_class_date, p_client_id) e
    where e.slot_id = p_slot_id
  ) then
    raise exception 'NOT_IN_CLASS' using errcode = 'P0001';
  end if;

  insert into public.attendance (class_date, slot_id, client_id, status, marked_by)
  values (p_class_date, p_slot_id, p_client_id, p_status, p_admin_id)
  on conflict (class_date, slot_id, client_id)
  do update set status = excluded.status, marked_by = excluded.marked_by, marked_at = now();
end;
$$;

-- Marca la misma asistencia para todos los asistentes de una clase.
create or replace function public.set_class_attendance(
  p_admin_id uuid,
  p_class_date date,
  p_slot_id integer,
  p_status text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_clients integer;
  v_trials integer;
begin
  if p_class_date > public.bogota_today() then
    raise exception 'FUTURE_ATTENDANCE' using errcode = 'P0001';
  end if;

  insert into public.attendance (class_date, slot_id, client_id, status, marked_by)
  select e.class_date, e.slot_id, e.person_id, p_status, p_admin_id
  from public.class_entries(p_class_date, p_class_date) e
  where e.slot_id = p_slot_id and e.entry_type = 'client'
  on conflict (class_date, slot_id, client_id)
  do update set status = excluded.status, marked_by = excluded.marked_by, marked_at = now();
  get diagnostics v_clients = row_count;

  update public.trials t
  set attendance = p_status
  where t.class_date = p_class_date and t.slot_id = p_slot_id and t.status <> 'cancelled';
  get diagnostics v_trials = row_count;

  return v_clients + v_trials;
end;
$$;

-- =============================================================================
-- Seguridad: RLS en todas las tablas expuestas. anon/authenticated (Data API)
-- no tienen acceso; solo el rol de servidor bh7_app.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'clients', 'time_slots', 'settings', 'client_schedules',
    'schedule_exceptions', 'attendance', 'trials', 'class_plans',
    'closed_days', 'sessions'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to bh7_app using (true) with check (true)',
      t || '_app_all', t
    );
  end loop;
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to bh7_app;
grant select, insert, update, delete on all tables in schema public to bh7_app;
grant usage, select on all sequences in schema public to bh7_app;
grant execute on all functions in schema public to bh7_app;

-- =============================================================================
-- Datos iniciales
-- =============================================================================

insert into public.settings default values;

insert into public.time_slots (start_time, end_time) values
  ('06:00', '07:00'),
  ('07:00', '08:00'),
  ('08:00', '09:00'),
  ('15:00', '16:00'),
  ('16:00', '17:00'),
  ('17:00', '18:00'),
  ('18:00', '19:00'),
  ('19:00', '20:00');

-- Administrador por defecto (bcrypt, compatible con bcryptjs).
insert into public.users (role, email, password_hash, full_name)
values (
  'admin',
  'boxhouseseven.tech@gmail.com',
  extensions.crypt('123456', extensions.gen_salt('bf', 10)),
  'Administrador'
)
on conflict (email) do nothing;
