"use client";

import { CalendarOffIcon, MoonIcon, SunIcon } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { DateNavigator } from "@/components/common/date-navigator";
import { PageHeader, SectionTitle } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAgendaDay, useAgendaWeek, usePrefetchAgendaDay } from "@/hooks/api/admin";
import { useNow, useUrlState } from "@/hooks/use-url-state";
import {
  addDaysISO,
  formatDateLong,
  formatWeekRange,
  isISODate,
  isoWeekday,
  relativeDayLabel,
  startOfWeekISO,
  todayISO,
  weekDatesISO,
} from "@/lib/dates";
import type { AgendaClass } from "@/lib/types";
import { ClassSheet } from "./class-sheet";
import { DayPlanCard } from "./day-plan-card";
import { SlotCard } from "./slot-card";
import { WeekGrid } from "./week-grid";
import { WeekStrip } from "./week-strip";

/** Salta al día de entrenamiento anterior/siguiente (omite días sin clases). */
function stepTrainingDay(date: string, dir: 1 | -1, weekdays: Set<number>): string {
  let next = addDaysISO(date, dir);
  if (weekdays.size === 0) return next;
  for (let i = 0; i < 7 && !weekdays.has(isoWeekday(next)); i++) next = addDaysISO(next, dir);
  return next;
}

function ClassList({
  title,
  icon,
  classes,
  now,
  onOpen,
}: {
  title: string;
  icon: React.ReactNode;
  classes: AgendaClass[];
  now: number;
  onOpen: (slotId: number) => void;
}) {
  if (!classes.length) return null;
  return (
    <section className="space-y-3">
      <SectionTitle className="flex items-center gap-2 pl-[4.75rem] sm:pl-[5.75rem] [&>svg]:size-3.5">
        {icon}
        {title}
      </SectionTitle>
      <div className="space-y-3">
        {classes.map((c) => (
          <SlotCard key={c.slotId} klass={c} now={now} onOpen={() => onOpen(c.slotId)} />
        ))}
      </div>
    </section>
  );
}

function DaySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {[0, 1].map((col) => (
        <div key={col} className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-16 sm:w-20" />
              <Skeleton className="h-28 flex-1 rounded-xl" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function AdminAgendaView() {
  const { get, set } = useUrlState();
  const today = todayISO();
  const rawDate = get("fecha");
  const date = rawDate && isISODate(rawDate) ? rawDate : today;
  const view = get("vista") === "semana" ? "week" : "day";
  const openSlotId = Number(get("clase")) || null;
  const weekStart = startOfWeekISO(date);
  const now = useNow(30_000);

  const day = useAgendaDay(date);
  const week = useAgendaWeek(weekStart);
  const prefetch = usePrefetchAgendaDay();

  const trainingWeekdays = useMemo(
    () => new Set((week.data?.slots ?? []).flatMap((s) => s.weekdays)),
    [week.data?.slots],
  );

  const goToDate = useCallback(
    (d: string, extra: Record<string, string | number | null> = {}) =>
      set({ fecha: d === today ? null : d, clase: null, ...extra }),
    [set, today],
  );

  const prevDate = view === "week" ? addDaysISO(weekStart, -7) : stepTrainingDay(date, -1, trainingWeekdays);
  const nextDate = view === "week" ? addDaysISO(weekStart, 7) : stepTrainingDay(date, 1, trainingWeekdays);

  // Precarga los días vecinos para que la navegación sea instantánea.
  useEffect(() => {
    if (view !== "day") return;
    void prefetch(prevDate);
    void prefetch(nextDate);
  }, [view, prevDate, nextDate, prefetch]);

  // Atajos de teclado: ← → para moverse, H para hoy.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (openSlotId || target.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") goToDate(prevDate);
      else if (e.key === "ArrowRight") goToDate(nextDate);
      else if (e.key.toLowerCase() === "h") goToDate(today);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToDate, prevDate, nextDate, today, openSlotId]);

  const stripDates = week.data?.days.map((d) => d.date) ?? weekDatesISO(date, 5);
  const classes = day.data?.date === date ? day.data.classes : (day.data?.classes ?? []);
  const morning = classes.filter((c) => c.startTime < "12:00");
  const afternoon = classes.filter((c) => c.startTime >= "12:00");
  const openClass = classes.find((c) => c.slotId === openSlotId) ?? null;
  const relative = relativeDayLabel(date, today);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agenda"
        description="Clases, asistentes y asistencia de cada día."
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            value={view}
            onValueChange={(v) => v && set({ vista: v === "week" ? "semana" : null, clase: null })}
            aria-label="Vista"
          >
            <ToggleGroupItem value="day" className="px-4">
              Día
            </ToggleGroupItem>
            <ToggleGroupItem value="week" className="px-4">
              Semana
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />

      <DateNavigator
        value={date}
        label={view === "week" ? `Semana del ${formatWeekRange(date)}` : formatDateLong(date)}
        sublabel={view === "day" ? (relative ?? undefined) : weekStart === startOfWeekISO(today) ? "Esta semana" : undefined}
        onPrev={() => goToDate(prevDate)}
        onNext={() => goToDate(nextDate)}
        onToday={() => goToDate(today)}
        onJump={(d) => goToDate(d)}
        isCurrent={view === "week" ? weekStart === startOfWeekISO(today) : date === today}
        prevLabel={view === "week" ? "Semana anterior" : "Día anterior (←)"}
        nextLabel={view === "week" ? "Semana siguiente" : "Día siguiente (→)"}
        todayLabel={view === "week" ? "Esta semana" : "Hoy"}
      />

      {view === "week" ? (
        week.isError ? (
          <ErrorState error={week.error} onRetry={() => week.refetch()} />
        ) : !week.data ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : (
          <div className={week.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <WeekGrid
              week={week.data}
              onOpenDay={(d) => goToDate(d, { vista: null })}
              onOpenClass={(d, slotId) => set({ fecha: d === today ? null : d, vista: null, clase: slotId })}
            />
          </div>
        )
      ) : (
        <>
          <WeekStrip
            dates={stripDates}
            selected={date}
            week={week.data}
            onSelect={(d) => goToDate(d)}
            onHover={(d) => void prefetch(d)}
          />

          {day.isError ? (
            <ErrorState error={day.error} onRetry={() => day.refetch()} />
          ) : !day.data ? (
            <DaySkeleton />
          ) : (
            <div
              className={
                day.isPlaceholderData
                  ? "space-y-5 opacity-60 transition-opacity"
                  : "animate-fade-up space-y-5 transition-opacity"
              }
            >
              {day.data.closedReason && (
                <Alert variant="destructive">
                  <CalendarOffIcon />
                  <AlertTitle>Gimnasio cerrado: {day.data.closedReason}</AlertTitle>
                  <AlertDescription>
                    No hay clases este día. Si aparecen personas inscritas, avísales.
                  </AlertDescription>
                </Alert>
              )}

              {classes.length === 0 ? (
                <EmptyState
                  icon={<CalendarOffIcon />}
                  title="No hay clases programadas este día"
                  description="Las clases se dictan según los horarios configurados (lunes a viernes por defecto)."
                />
              ) : (
                <>
                  <DayPlanCard date={date} plan={day.data.plan} />

                  <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
                    <ClassList
                      title="Mañana"
                      icon={<SunIcon />}
                      classes={morning}
                      now={now}
                      onOpen={(slotId) => set({ clase: slotId })}
                    />
                    <ClassList
                      title="Tarde y noche"
                      icon={<MoonIcon />}
                      classes={afternoon}
                      now={now}
                      onOpen={(slotId) => set({ clase: slotId })}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      <ClassSheet
        klass={openClass}
        open={view === "day" && openClass !== null}
        onOpenChange={(o) => !o && set({ clase: null })}
        now={now}
        closedReason={day.data?.closedReason ?? null}
      />
    </div>
  );
}
