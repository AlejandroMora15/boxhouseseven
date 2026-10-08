"use client";

import { ClipboardListIcon, SaveIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DateNavigator } from "@/components/common/date-navigator";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { usePlans, useSavePlan } from "@/hooks/api/admin";
import { useUrlState } from "@/hooks/use-url-state";
import { WEEKDAYS } from "@/lib/constants";
import {
  addDaysISO,
  addMonthsISO,
  endOfMonthISO,
  formatDateLong,
  formatMonth,
  isISODate,
  isoWeekday,
  parseISODate,
  relativeDayLabel,
  startOfMonthISO,
  startOfWeekISO,
  todayISO,
} from "@/lib/dates";
import type { ClassPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

const SNIPPETS = [
  "Calentamiento",
  "Movilidad",
  "Técnica",
  "Sombra",
  "Manoplas",
  "Saco",
  "Sparring",
  "Acondicionamiento",
  "Core",
  "Estiramiento",
];

const MAX = 5000;

function monthGrid(month: string): string[] {
  const first = startOfWeekISO(startOfMonthISO(month));
  const lastDay = endOfMonthISO(month);
  const last = addDaysISO(startOfWeekISO(lastDay), 6);
  const days: string[] = [];
  for (let d = first; d <= last; d = addDaysISO(d, 1)) days.push(d);
  return days;
}

function PlanEditor({
  date,
  plan,
  onDirtyChange,
  registerFlush,
}: {
  date: string;
  plan: ClassPlan | undefined;
  onDirtyChange: (dirty: boolean) => void;
  registerFlush: (fn: () => void) => void;
}) {
  const save = useSavePlan();
  const [draft, setDraft] = useState(plan?.content ?? "");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const saved = plan?.content ?? "";
  const dirty = draft.trim() !== saved.trim();

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  function persist(content: string, quiet = false) {
    save.mutate(
      { date, content },
      {
        onSuccess: () => {
          if (!quiet) toast.success(content.trim() ? "Planificación guardada." : "Planificación eliminada.");
        },
      },
    );
  }

  // Al cambiar de día con cambios sin guardar, se guardan automáticamente.
  useEffect(() => {
    registerFlush(() => {
      if (dirty) {
        persist(draft, true);
        toast.success(`Se guardó la planificación del ${formatDateLong(date)}.`);
      }
    });
  });

  function insertSnippet(label: string) {
    const prefix = draft && !draft.endsWith("\n") ? "\n" : "";
    const next = `${draft}${prefix}• ${label}: `;
    setDraft(next.slice(0, MAX));
    requestAnimationFrame(() => {
      const el = textarea.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.length, next.length);
    });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {relativeDayLabel(date) ?? "Planificación"}
          </p>
          <h2 className="font-heading text-2xl font-bold">{formatDateLong(date)}</h2>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/agenda?fecha=${date}`}>Ver agenda del día</Link>
        </Button>
      </div>

      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {SNIPPETS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => insertSnippet(s)}
            className="h-7 shrink-0 rounded-full border bg-card px-3 text-xs font-medium transition-colors hover:border-foreground/40 hover:bg-accent active:scale-95"
          >
            + {s}
          </button>
        ))}
      </div>

      <Textarea
        ref={textarea}
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            if (dirty) persist(draft);
          }
        }}
        placeholder={"Describe la clase del día: calentamiento, técnica, rounds, acondicionamiento…\n\nEjemplo:\n• Calentamiento: 3 rounds de cuerda\n• Técnica: jab–cross–hook\n• Saco: 6 × 2 min"}
        className="min-h-72 flex-1 resize-y text-[0.95rem] leading-relaxed"
        aria-label={`Planificación del ${formatDateLong(date)}`}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {draft.length}/{MAX} ·{" "}
          {dirty ? (
            <span className="font-semibold text-warning">Cambios sin guardar</span>
          ) : plan ? (
            "Guardado"
          ) : (
            "Sin planificación"
          )}
          <span className="hidden sm:inline">
            {" "}
            · <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> para guardar
          </span>
        </span>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="ghost" onClick={() => setDraft(saved)} disabled={save.isPending}>
              Descartar
            </Button>
          )}
          <Button onClick={() => persist(draft)} disabled={!dirty || save.isPending}>
            {save.isPending ? <Spinner /> : <SaveIcon />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PlansView() {
  const { get, set } = useUrlState();
  const today = todayISO();
  const raw = get("fecha");
  const date = raw && isISODate(raw) ? raw : today;
  const month = startOfMonthISO(date);
  const days = monthGrid(month);
  const plans = usePlans(days[0], days[days.length - 1]);
  const byDate = new Map((plans.data ?? []).map((p) => [p.date, p]));
  const [dirty, setDirty] = useState(false);
  const flushRef = useRef<() => void>(() => {});

  function select(d: string) {
    if (d === date) return;
    if (dirty) flushRef.current();
    set({ fecha: d === today ? null : d });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Planificación"
        description="Escribe el plan de entrenamiento de cada día para tener las clases listas."
      />

      <DateNavigator
        value={date}
        label={formatMonth(month)}
        onPrev={() => select(addMonthsISO(month, -1))}
        onNext={() => select(addMonthsISO(month, 1))}
        onToday={() => select(today)}
        onJump={select}
        isCurrent={month === startOfMonthISO(today)}
        prevLabel="Mes anterior"
        nextLabel="Mes siguiente"
        todayLabel="Hoy"
      />

      {plans.isError ? (
        <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {/* Calendario mensual */}
          <div className="min-w-0 rounded-2xl border bg-card p-2 sm:p-3">
            <div className="grid grid-cols-7 gap-1 pb-1">
              {WEEKDAYS.map((w) => (
                <div
                  key={w.iso}
                  className="py-1 text-center text-[0.68rem] font-semibold tracking-wider text-muted-foreground uppercase"
                >
                  <span className="sm:hidden">{w.letter}</span>
                  <span className="hidden sm:inline">{w.short}</span>
                </div>
              ))}
            </div>
            {!plans.data ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const plan = byDate.get(d);
                  const inMonth = d.slice(0, 7) === month.slice(0, 7);
                  const weekend = isoWeekday(d) > 5;
                  const selected = d === date;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => select(d)}
                      aria-pressed={selected}
                      aria-label={`${formatDateLong(d)}${plan ? ", con planificación" : ""}`}
                      className={cn(
                        "group relative flex aspect-square min-w-0 flex-col items-start overflow-hidden rounded-lg border p-1.5 text-left transition-all sm:aspect-auto sm:min-h-24 sm:p-2",
                        selected
                          ? "border-foreground bg-foreground text-background shadow-md"
                          : "border-transparent hover:border-foreground/20 hover:bg-accent",
                        !inMonth && !selected && "opacity-35",
                        weekend && !selected && "bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-sm font-semibold",
                          d === today && !selected && "bg-brand text-white",
                        )}
                      >
                        {parseISODate(d).getDate()}
                      </span>
                      {plan && (
                        <>
                          <span
                            className={cn(
                              "absolute right-1.5 bottom-1.5 size-1.5 rounded-full sm:hidden",
                              selected ? "bg-background" : "bg-brand",
                            )}
                          />
                          <span className="mt-1 hidden w-full sm:block">
                            <span
                              className={cn(
                                "line-clamp-3 text-[0.7rem] leading-snug break-words",
                                selected ? "text-background/80" : "text-muted-foreground",
                              )}
                            >
                              {plan.content}
                            </span>
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="flex items-center gap-2 px-1 pt-3 text-xs text-muted-foreground">
              <ClipboardListIcon className="size-3.5" />
              {plans.data ? `${plans.data.filter((p) => p.date.slice(0, 7) === month.slice(0, 7)).length} días planificados este mes` : "…"}
            </p>
          </div>

          {/* Editor del día */}
          <div className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5 lg:sticky lg:top-6 lg:self-start">
            {plans.data ? (
              <PlanEditor
                key={date}
                date={date}
                plan={byDate.get(date)}
                onDirtyChange={setDirty}
                registerFlush={(fn) => (flushRef.current = fn)}
              />
            ) : (
              <Skeleton className="h-96 w-full" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
