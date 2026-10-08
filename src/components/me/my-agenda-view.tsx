"use client";

import { ArrowRightLeftIcon, CalendarX2Icon, ChevronRightIcon, CoffeeIcon, FlameIcon } from "lucide-react";
import { useMemo } from "react";
import { AttendanceBadge, OriginBadge, Pill } from "@/components/common/badges";
import { DateNavigator } from "@/components/common/date-navigator";
import { ErrorState } from "@/components/common/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyAgenda, useMyProfile } from "@/hooks/api/me";
import { useNow, useUrlState } from "@/hooks/use-url-state";
import { classTiming, timeUntil } from "@/lib/class-status";
import { PLANS, weekdayLabel } from "@/lib/constants";
import {
  addDaysISO,
  formatDateLong,
  formatDateShort,
  formatTime,
  formatTimeRange,
  formatWeekRange,
  isISODate,
  isoWeekday,
  parseISODate,
  relativeDayLabel,
  startOfWeekISO,
  todayISO,
} from "@/lib/dates";
import type { ClientClass } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClassDetailSheet } from "./reschedule-sheet";

function ClassStatus({ klass, now }: { klass: ClientClass; now: number }) {
  if (klass.closedReason) return <Pill tone="danger">Cerrado</Pill>;
  const timing = classTiming(klass.date, klass.startTime, klass.endTime, now);
  if (timing === "live") return <Pill tone="brand">En curso</Pill>;
  if (timing === "done") return <AttendanceBadge status={klass.attendance} />;
  return <Pill tone="success">{timeUntil(klass.date, klass.startTime, now)}</Pill>;
}

export function MyAgendaView() {
  const { get, set } = useUrlState();
  const today = todayISO();
  const raw = get("semana");
  const anchor = raw && isISODate(raw) ? raw : today;
  const weekStart = startOfWeekISO(anchor);
  const isThisWeek = weekStart === startOfWeekISO(today);
  const openKey = get("clase");
  const now = useNow(30_000);

  const agenda = useMyAgenda(weekStart);
  const profile = useMyProfile();
  const data = agenda.data;

  const days = useMemo(() => {
    const list = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));
    return list.filter((d, i) => i < 5 || data?.classes.some((c) => c.date === d));
  }, [weekStart, data]);

  const classes = data?.classes.filter((c) => c.origin !== "attendance" || c.attendance) ?? [];
  const next = classes.find(
    (c) => !c.closedReason && classTiming(c.date, c.startTime, c.endTime, now) !== "done",
  );
  const openClass = classes.find((c) => `${c.date}_${c.slotId}` === openKey) ?? null;
  const firstName = profile.data?.fullName.split(" ")[0];
  const attended = classes.filter((c) => c.attendance === "present").length;

  const goWeek = (d: string) => set({ semana: startOfWeekISO(d) === startOfWeekISO(today) ? null : d, clase: null });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">{firstName ? `Hola, ${firstName} 👊` : "Hola 👊"}</p>
        <h1 className="text-display text-4xl leading-none">Mi agenda</h1>
      </div>

      {/* Próxima clase */}
      {isThisWeek && data && (
        <div className="relative overflow-hidden rounded-2xl bg-sidebar p-5 text-white shadow-lg">
          <div aria-hidden className="pointer-events-none absolute -right-12 -bottom-16 size-48 rounded-full bg-brand/35 blur-3xl" />
          {next ? (
            <button
              type="button"
              className="relative block w-full text-left"
              onClick={() => set({ clase: `${next.date}_${next.slotId}` })}
            >
              <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">
                <FlameIcon className="size-3.5 text-brand" />
                {classTiming(next.date, next.startTime, next.endTime, now) === "live" ? "Clase en curso" : "Tu próxima clase"}
              </p>
              <p className="mt-2 font-heading text-4xl leading-none font-bold">
                {relativeDayLabel(next.date) ?? weekdayLabel(isoWeekday(next.date))}, {formatTime(next.startTime)}
              </p>
              <p className="mt-1.5 text-sm text-white/70">
                {formatDateLong(next.date)} · {timeUntil(next.date, next.startTime, now)}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-white">
                Ver detalle <ChevronRightIcon className="size-4" />
              </span>
            </button>
          ) : (
            <div className="relative">
              <p className="text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">Esta semana</p>
              <p className="mt-2 font-heading text-3xl font-bold">No tienes más clases esta semana</p>
              <p className="mt-1 text-sm text-white/70">¡Descansa y vuelve con todo la próxima semana!</p>
            </div>
          )}
        </div>
      )}

      <DateNavigator
        value={anchor}
        label={formatWeekRange(weekStart)}
        sublabel={isThisWeek ? "Esta semana" : "Semana"}
        onPrev={() => goWeek(addDaysISO(weekStart, -7))}
        onNext={() => goWeek(addDaysISO(weekStart, 7))}
        onToday={() => goWeek(today)}
        onJump={goWeek}
        isCurrent={isThisWeek}
        prevLabel="Semana anterior"
        nextLabel="Semana siguiente"
        todayLabel="Hoy"
      />

      {agenda.isError ? (
        <ErrorState error={agenda.error} onRetry={() => agenda.refetch()} />
      ) : !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className={cn("space-y-4 transition-opacity", agenda.isPlaceholderData && "opacity-60")}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Pill tone="dark">{PLANS[data.plan].label}</Pill>
            <span className="text-muted-foreground">
              {classes.filter((c) => !c.closedReason).length} clases esta semana
              {attended ? ` · ${attended} asistidas` : ""}
            </span>
          </div>

          <ol className="space-y-2">
            {days.map((date) => {
              const dayClasses = classes.filter((c) => c.date === date);
              const isToday = date === today;
              return (
                <li key={date} className="flex gap-3">
                  <div
                    className={cn(
                      "flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border py-2",
                      isToday ? "border-brand bg-brand text-white" : "bg-card",
                    )}
                  >
                    <span className={cn("text-[0.65rem] font-semibold tracking-wider uppercase", isToday ? "text-white/80" : "text-muted-foreground")}>
                      {weekdayLabel(isoWeekday(date), "short")}
                    </span>
                    <span className="font-heading text-2xl leading-none font-bold">{parseISODate(date).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    {dayClasses.length === 0 ? (
                      <div className="flex h-full min-h-16 items-center gap-2 rounded-xl border border-dashed px-4 text-sm text-muted-foreground">
                        <CoffeeIcon className="size-4" /> Día de descanso
                      </div>
                    ) : (
                      dayClasses.map((c) => (
                        <button
                          key={c.slotId}
                          type="button"
                          onClick={() => set({ clase: `${c.date}_${c.slotId}` })}
                          className={cn(
                            "group flex min-h-16 w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
                            c.closedReason && "border-destructive/30 bg-destructive/5",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-heading text-xl font-bold">{formatTimeRange(c.startTime, c.endTime)}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <ClassStatus klass={c} now={now} />
                              <OriginBadge origin={c.origin} />
                              {c.movedFrom && (
                                <span className="text-xs text-muted-foreground">
                                  antes {formatDateShort(c.movedFrom.date)} {formatTime(c.movedFrom.startTime)}
                                </span>
                              )}
                              {c.closedReason && (
                                <span className="text-xs text-destructive">{c.closedReason} — reagéndala</span>
                              )}
                            </div>
                          </div>
                          {c.canReschedule ? (
                            <span className="hidden items-center gap-1 text-xs font-semibold text-muted-foreground group-hover:text-foreground sm:flex">
                              <ArrowRightLeftIcon className="size-3.5" /> Reagendar
                            </span>
                          ) : null}
                          <ChevronRightIcon className="size-4 text-muted-foreground" />
                        </button>
                      ))
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {classes.length === 0 && (
            <div className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              <CalendarX2Icon className="size-5" />
              No tienes clases programadas en esta semana.
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Puedes reagendar una clase a otro día u hora de la misma semana si hay cupos, hasta{" "}
            {data.cutoffMinutes} minutos antes de que empiece.
          </p>
        </div>
      )}

      <ClassDetailSheet
        klass={openClass}
        onOpenChange={(o) => !o && set({ clase: null })}
        cutoffMinutes={data?.cutoffMinutes ?? 60}
        now={now}
      />
    </div>
  );
}
