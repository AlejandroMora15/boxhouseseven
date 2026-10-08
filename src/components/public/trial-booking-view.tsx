"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarPlusIcon,
  CheckIcon,
  ClockIcon,
  DropletsIcon,
  LogInIcon,
  MapPinIcon,
  MessageCircleIcon,
  MoonIcon,
  ShirtIcon,
  SunIcon,
  UsersIcon,
  WindIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { LogoMark } from "@/components/brand/logo";
import { applyServerFieldErrors, TextField } from "@/components/common/form-fields";
import { ErrorState } from "@/components/common/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useBookTrial, useCheckTrialPerson, usePublicAvailability, usePublicInfo } from "@/hooks/api/public";
import { ApiError } from "@/lib/api-client";
import { TRIAL_CHECKLIST, weekdayLabel } from "@/lib/constants";
import {
  classStartsAt,
  formatDateLong,
  formatTime,
  formatTimeRange,
  isoWeekday,
  parseISODate,
  relativeDayLabel,
} from "@/lib/dates";
import { whatsappLink } from "@/lib/format";
import { trialPersonSchema, type TrialPersonInput } from "@/lib/schemas";
import type { TrialConfirmation } from "@/lib/types";
import { cn } from "@/lib/utils";

type Person = z.output<typeof trialPersonSchema>;
type Step = 1 | 2 | 3;

const CHECKLIST_ICONS = [DropletsIcon, WindIcon, ShirtIcon];

function Checklist({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-brand/25 bg-brand/5", compact ? "p-3" : "p-4")}>
      <p className="text-sm font-semibold">Para tu clase solo necesitas traer:</p>
      <ul className={cn("mt-2 grid grid-cols-3 gap-2", compact && "mt-1.5")}>
        {TRIAL_CHECKLIST.map((item, i) => {
          const Icon = CHECKLIST_ICONS[i];
          return (
            <li key={item} className="flex flex-col items-center gap-1 rounded-lg bg-card p-2 text-center text-xs font-medium">
              <Icon className="size-5 text-brand" />
              {item}
            </li>
          );
        })}
      </ul>
      {!compact && <p className="mt-2 text-xs text-muted-foreground">Los guantes y el equipo te los prestamos nosotros.</p>}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = ["Tus datos", "Elige tu clase", "¡Listo!"];
  return (
    <ol className="flex items-center gap-2" aria-label="Pasos">
      {steps.map((label, i) => {
        const n = (i + 1) as Step;
        const done = step > n;
        const active = step === n;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                done ? "bg-success text-white" : active ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <CheckIcon className="size-4" /> : n}
            </span>
            <span className={cn("hidden text-sm font-medium sm:inline", !active && "text-muted-foreground")}>{label}</span>
            {i < steps.length - 1 && <span className={cn("h-px flex-1", done ? "bg-success" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}

function googleCalendarUrl(c: TrialConfirmation): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = classStartsAt(c.classDate, c.startTime);
  const end = classStartsAt(c.classDate, c.endTime);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Clase de prueba · Boxhouseseven",
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Recuerda llevar: ${TRIAL_CHECKLIST.join(", ").toLowerCase()}.`,
    ...(c.address ? { location: c.address } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Paso 1: datos personales
// ---------------------------------------------------------------------------

function PersonStep({ initial, onNext }: { initial: TrialPersonInput; onNext: (p: Person) => void }) {
  const check = useCheckTrialPerson();
  const [problem, setProblem] = useState<{ code: string; message: string } | null>(null);
  const form = useForm<TrialPersonInput, unknown, Person>({
    resolver: zodResolver(trialPersonSchema),
    defaultValues: initial,
  });

  async function submit(values: Person) {
    setProblem(null);
    try {
      await check.mutateAsync(values);
      onNext(values);
    } catch (error) {
      if (error instanceof ApiError) {
        if (!applyServerFieldErrors(error.fields, form.setError as never, ["fullName", "document", "phone", "email"])) {
          setProblem({ code: error.code, message: error.message });
        }
      } else {
        setProblem({ code: "INTERNAL", message: "No pudimos validar tus datos. Intenta de nuevo." });
      }
    }
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-5">
      <div>
        <h2 className="text-display text-3xl">Cuéntanos quién eres</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verificamos que no tengas una clase de prueba previa y te mostramos los horarios con cupo.
        </p>
      </div>

      {problem && (
        <Alert variant={problem.code === "ALREADY_TRIAL" ? "default" : "destructive"} className="animate-fade-up">
          <AlertTitle>
            {problem.code === "ALREADY_CLIENT"
              ? "Ya eres parte de Boxhouseseven"
              : problem.code === "ALREADY_TRIAL"
                ? "Ya tienes una clase de prueba"
                : "No pudimos continuar"}
          </AlertTitle>
          <AlertDescription>
            <p>{problem.message}</p>
            {problem.code === "ALREADY_CLIENT" && (
              <Button asChild size="sm" className="mt-2">
                <Link href="/login">
                  <LogInIcon /> Iniciar sesión
                </Link>
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="fullName" label="Nombre completo" autoComplete="name" className="sm:col-span-2" />
        <TextField
          control={form.control}
          name="document"
          label="Número de documento"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Sin puntos"
        />
        <TextField
          control={form.control}
          name="phone"
          label="Celular"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="300 123 4567"
        />
        <TextField
          control={form.control}
          name="email"
          label="Correo electrónico"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="sm:col-span-2"
        />
        {/* Campo trampa para bots: oculto para personas. */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
          {...form.register("website")}
        />
      </FieldGroup>

      <Checklist />

      <Button type="submit" size="lg" className="w-full" disabled={check.isPending}>
        {check.isPending ? <Spinner /> : null}
        Siguiente: elegir horario
        {!check.isPending && <ArrowRightIcon />}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Usaremos tus datos solo para gestionar tu clase de prueba.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Paso 2: elegir día y hora
// ---------------------------------------------------------------------------

function ScheduleStep({
  person,
  onBack,
  onBooked,
  onPersonProblem,
}: {
  person: Person;
  onBack: () => void;
  onBooked: (c: TrialConfirmation) => void;
  onPersonProblem: (message: string) => void;
}) {
  const availability = usePublicAvailability(true);
  const book = useBookTrial();
  const days = useMemo(() => availability.data?.days ?? [], [availability.data]);
  const [pickedDate, setDate] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<number | null>(null);
  // Por defecto se muestra el primer día con cupos.
  const date = pickedDate ?? days.find((d) => d.slots.some((s) => s.bookable))?.date ?? null;

  const day = days.find((d) => d.date === date);
  const slot = day?.slots.find((s) => s.slotId === slotId);

  async function confirm() {
    if (!date || !slotId) return;
    try {
      const res = await book.mutateAsync({ ...person, classDate: date, slotId });
      onBooked(res);
    } catch (error) {
      if (error instanceof ApiError && ["ALREADY_CLIENT", "ALREADY_TRIAL", "ALREADY_REGISTERED"].includes(error.code)) {
        onPersonProblem(error.message);
        return;
      }
      toast.error(error instanceof ApiError ? error.message : "No pudimos agendar la clase. Intenta de nuevo.");
      setSlotId(null);
      void availability.refetch();
    }
  }

  if (availability.isError) return <ErrorState error={availability.error} onRetry={() => availability.refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-display text-3xl">Elige tu clase</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hola {person.fullName.split(" ")[0]}, estos son los horarios con cupo. Cada clase dura 1 hora y tiene máximo{" "}
            {availability.data?.capacity ?? 7} personas.
          </p>
        </div>
      </div>

      {!availability.data ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : days.length === 0 ? (
        <Alert>
          <AlertTitle>No hay clases disponibles por ahora</AlertTitle>
          <AlertDescription>Vuelve a intentarlo más tarde o escríbenos.</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8" role="listbox" aria-label="Días">
            {days.map((d) => {
              const free = d.slots.filter((s) => s.bookable).length;
              const selected = d.date === date;
              const disabled = Boolean(d.closedReason) || free === 0;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={`${formatDateLong(d.date)}: ${d.closedReason ? "cerrado" : free === 0 ? "sin cupos" : `${free} horarios disponibles`}`}
                  disabled={disabled}
                  onClick={() => {
                    setDate(d.date);
                    setSlotId(null);
                  }}
                  className={cn(
                    "flex min-w-[4.6rem] shrink-0 flex-col items-center rounded-xl border px-2 py-2.5 transition-all active:scale-95",
                    selected ? "border-foreground bg-foreground text-background shadow-md" : "bg-card hover:border-foreground/40",
                    disabled && "cursor-not-allowed opacity-45",
                  )}
                >
                  <span className={cn("text-[0.65rem] font-semibold tracking-wider uppercase", selected ? "text-background/70" : "text-muted-foreground")}>
                    {relativeDayLabel(d.date) ?? weekdayLabel(isoWeekday(d.date), "short")}
                  </span>
                  <span className="font-heading text-2xl leading-none font-bold">{parseISODate(d.date).getDate()}</span>
                  <span className={cn("mt-1 text-[0.65rem]", selected ? "text-background/70" : "text-muted-foreground")}>
                    {d.closedReason ? "Cerrado" : free === 0 ? "Sin cupos" : `${free} ${free === 1 ? "horario" : "horarios"}`}
                  </span>
                </button>
              );
            })}
          </div>

          {day && (
            <div className="space-y-4 animate-fade-up" key={day.date}>
              <p className="font-heading text-lg font-semibold">{formatDateLong(day.date)}</p>
              {(["morning", "afternoon"] as const).map((part) => {
                const list = day.slots.filter(
                  (s) => s.status !== "past" && (part === "morning" ? s.startTime < "12:00" : s.startTime >= "12:00"),
                );
                if (!list.length) return null;
                return (
                  <div key={part} className="space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      {part === "morning" ? <SunIcon className="size-3.5" /> : <MoonIcon className="size-3.5" />}
                      {part === "morning" ? "Mañana" : "Tarde y noche"}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {list.map((s) => {
                        const selected = s.slotId === slotId;
                        return (
                          <button
                            key={s.slotId}
                            type="button"
                            disabled={!s.bookable}
                            aria-pressed={selected}
                            onClick={() => setSlotId(s.slotId)}
                            className={cn(
                              "flex flex-col items-start rounded-xl border px-3.5 py-3 text-left transition-all active:scale-[0.98]",
                              selected ? "border-brand bg-brand text-white shadow-md" : "bg-card hover:border-foreground/40",
                              !s.bookable && "cursor-not-allowed bg-muted/50 opacity-55",
                            )}
                          >
                            <span className="font-heading text-xl font-bold">{formatTime(s.startTime)}</span>
                            <span className={cn("flex items-center gap-1 text-xs", selected ? "text-white/85" : "text-muted-foreground")}>
                              <UsersIcon className="size-3" />
                              {s.status === "full"
                                ? "Sin cupos"
                                : !s.bookable
                                  ? "No disponible"
                                  : `${s.available} ${s.available === 1 ? "cupo" : "cupos"}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Checklist compact />

      <div className="sticky bottom-0 -mx-5 -mb-5 space-y-3 rounded-b-2xl border-t bg-card/95 p-5 backdrop-blur sm:-mx-8 sm:-mb-8 sm:px-8">
        {slot && date ? (
          <p className="flex items-center gap-2 text-sm">
            <ClockIcon className="size-4 text-brand" />
            <strong>{relativeDayLabel(date) ?? formatDateLong(date)}</strong> · {formatTimeRange(slot.startTime, slot.endTime)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Selecciona el día y la hora de tu clase.</p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={onBack} disabled={book.isPending} aria-label="Atrás">
            <ArrowLeftIcon /> <span className="hidden sm:inline">Atrás</span>
          </Button>
          <Button variant="brand" size="lg" className="flex-1" disabled={!slot || book.isPending} onClick={confirm}>
            {book.isPending ? <Spinner /> : <CheckIcon />}
            <span className="sm:hidden">Confirmar</span>
            <span className="hidden sm:inline">Confirmar clase de prueba</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paso 3: confirmación
// ---------------------------------------------------------------------------

function DoneStep({ confirmation }: { confirmation: TrialConfirmation }) {
  const info = usePublicInfo();
  const whatsapp = confirmation.whatsappPhone ?? info.data?.whatsappPhone;
  const address = confirmation.address ?? info.data?.address;
  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-success text-white shadow-lg animate-pop-in">
        <CheckIcon className="size-10" strokeWidth={3} />
      </div>
      <div>
        <h2 className="text-display text-4xl">¡Te esperamos, {confirmation.fullName.split(" ")[0]}!</h2>
        <p className="mt-1 text-muted-foreground">Tu clase de prueba quedó agendada.</p>
      </div>
      <div className="rounded-2xl bg-sidebar p-5 text-left text-white">
        <p className="text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">Tu clase</p>
        <p className="mt-1 font-heading text-3xl font-bold">{formatDateLong(confirmation.classDate)}</p>
        <p className="text-lg text-white/80">{formatTimeRange(confirmation.startTime, confirmation.endTime)}</p>
        {address && (
          <p className="mt-3 flex items-center gap-2 text-sm text-white/80">
            <MapPinIcon className="size-4" /> {address}
          </p>
        )}
      </div>
      <Checklist />
      <p className="text-sm text-muted-foreground">Llega 10 minutos antes para conocer el espacio y calentar.</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button variant="outline" asChild>
          <a href={googleCalendarUrl(confirmation)} target="_blank" rel="noreferrer">
            <CalendarPlusIcon /> Agregar a mi calendario
          </a>
        </Button>
        {whatsapp && (
          <Button variant="outline" asChild>
            <a href={whatsappLink(whatsapp, "Hola, agendé una clase de prueba en Boxhouseseven.")} target="_blank" rel="noreferrer">
              <MessageCircleIcon className="text-success" /> Escríbenos por WhatsApp
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

export function TrialBookingView() {
  const [step, setStep] = useState<Step>(1);
  const [person, setPerson] = useState<Person | null>(null);
  const [confirmation, setConfirmation] = useState<TrialConfirmation | null>(null);
  const [personProblem, setPersonProblem] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="relative overflow-hidden bg-sidebar pb-24 text-white">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 opacity-[0.08]">
          <LogoMark className="h-80 text-white" />
        </div>
        <div className="relative mx-auto max-w-2xl px-5 pt-6 sm:px-8">
          <div className="flex items-center justify-between">
            <Link href="/clase-de-prueba" className="flex items-center gap-2.5">
              <LogoMark className="h-6 text-white" />
              <span className="text-xs font-medium tracking-[0.28em]">BOXHOUSESEVEN</span>
            </Link>
            <Link href="/login" className="text-sm font-medium text-white/70 hover:text-white">
              Soy cliente
            </Link>
          </div>
          <div className="mt-10">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase">
              <span className="size-1.5 rounded-full bg-brand" /> Primera clase gratis
            </p>
            <h1 className="text-display mt-3 text-5xl leading-[0.95] sm:text-6xl">
              Clase de prueba
              <br />
              <span className="text-brand">de boxeo</span>
            </h1>
            <p className="mt-3 max-w-md text-white/70">
              Una hora de entrenamiento en grupos pequeños en Cartago. Agenda tu cupo en menos de un minuto.
            </p>
          </div>
        </div>
      </header>

      <main className="relative mx-auto -mt-16 max-w-2xl px-3 pb-12 sm:px-8">
        <div className="relative rounded-2xl border bg-card p-5 shadow-xl sm:p-8">
          <div className="mb-6">
            <Stepper step={step} />
          </div>
          {step === 1 && (
            <>
              {personProblem && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{personProblem}</AlertDescription>
                </Alert>
              )}
              <PersonStep
                initial={person ?? { fullName: "", document: "", phone: "", email: "", website: "" }}
                onNext={(p) => {
                  setPerson(p);
                  setPersonProblem(null);
                  setStep(2);
                }}
              />
            </>
          )}
          {step === 2 && person && (
            <ScheduleStep
              person={person}
              onBack={() => setStep(1)}
              onBooked={(c) => {
                setConfirmation(c);
                setStep(3);
              }}
              onPersonProblem={(message) => {
                setPersonProblem(message);
                setStep(1);
              }}
            />
          )}
          {step === 3 && confirmation && <DoneStep confirmation={confirmation} />}
        </div>
      </main>
    </div>
  );
}
