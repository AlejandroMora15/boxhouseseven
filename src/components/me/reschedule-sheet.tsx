"use client";

import { ArrowRightIcon, CalendarClockIcon, CheckIcon, InfoIcon, LockIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AttendanceBadge, OriginBadge, Pill } from "@/components/common/badges";
import { ErrorState } from "@/components/common/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useReschedule, useRescheduleOptions } from "@/hooks/api/me";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ApiError } from "@/lib/api-client";
import { classTiming } from "@/lib/class-status";
import { formatDateLong, formatDateShort, formatTime, formatTimeRange, relativeDayLabel } from "@/lib/dates";
import type { ClientClass } from "@/lib/types";
import { cn } from "@/lib/utils";

function minutesLabel(minutes: number): string {
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} ${h === 1 ? "hora" : "horas"}`;
  }
  return `${minutes} minutos`;
}

/** Detalle de una clase del cliente con el flujo para reagendarla. */
export function ClassDetailSheet({
  klass,
  onOpenChange,
  cutoffMinutes,
  now,
}: {
  klass: ClientClass | null;
  onOpenChange: (open: boolean) => void;
  cutoffMinutes: number;
  now: number;
}) {
  const desktop = useMediaQuery("(min-width: 640px)");
  const [choosing, setChoosing] = useState(false);
  const [target, setTarget] = useState<{ date: string; slotId: number; startTime: string; endTime: string } | null>(
    null,
  );
  const options = useRescheduleOptions(klass?.date ?? "", klass?.slotId ?? 0, Boolean(klass && choosing));
  const reschedule = useReschedule();

  // Al abrir otra clase se reinicia el flujo de reagendar.
  const classKey = klass ? `${klass.date}_${klass.slotId}` : null;
  const [stateKey, setStateKey] = useState(classKey);
  if (classKey !== stateKey) {
    setStateKey(classKey);
    setChoosing(false);
    setTarget(null);
  }

  if (!klass) return null;
  const timing = classTiming(klass.date, klass.startTime, klass.endTime, now);
  // Solo se muestran los horarios que aún no pasaron.
  const upcomingDays = (options.data?.days ?? [])
    .map((day) => ({ ...day, options: day.options.filter((o) => o.status !== "past") }))
    .filter((day) => day.options.length > 0);

  async function confirm() {
    if (!klass || !target) return;
    try {
      await reschedule.mutateAsync({
        fromDate: klass.date,
        fromSlotId: klass.slotId,
        toDate: target.date,
        toSlotId: target.slotId,
      });
      toast.success(`¡Listo! Tu clase quedó para el ${formatDateLong(target.date)} a las ${formatTime(target.startTime)}.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo reagendar la clase.");
      void options.refetch();
      setTarget(null);
    }
  }

  return (
    <Sheet open={klass !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-2xl p-0 sm:max-h-none sm:rounded-none data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b p-5">
          <div className="flex flex-wrap items-center gap-1.5 pr-8">
            {klass.closedReason ? (
              <Pill tone="danger">Cerrado: {klass.closedReason}</Pill>
            ) : timing === "live" ? (
              <Pill tone="brand">En curso</Pill>
            ) : timing === "done" ? (
              <AttendanceBadge status={klass.attendance} />
            ) : (
              <Pill tone="success">Próxima</Pill>
            )}
            <OriginBadge origin={klass.origin} />
          </div>
          <SheetTitle className="text-display text-3xl leading-none">
            {formatTimeRange(klass.startTime, klass.endTime)}
          </SheetTitle>
          <SheetDescription>
            {relativeDayLabel(klass.date) ? `${relativeDayLabel(klass.date)} · ` : ""}
            {formatDateLong(klass.date)}
          </SheetDescription>
          {klass.movedFrom && (
            <p className="text-xs text-muted-foreground">
              Reagendada desde el {formatDateShort(klass.movedFrom.date)} a las {formatTime(klass.movedFrom.startTime)}.
            </p>
          )}
        </SheetHeader>

        <div className="space-y-4 p-5">
          {klass.closedReason && (
            <Alert variant="destructive">
              <AlertDescription>
                El gimnasio estará cerrado ese día ({klass.closedReason}). Reagenda tu clase para otro día de esta semana.
              </AlertDescription>
            </Alert>
          )}

          {!klass.canReschedule ? (
            <div className="flex items-start gap-3 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
              <LockIcon className="mt-0.5 size-4 shrink-0" />
              {klass.attendance
                ? "La asistencia de esta clase ya fue registrada."
                : timing === "upcoming"
                  ? `Las clases se pueden reagendar hasta ${minutesLabel(cutoffMinutes)} antes de empezar.`
                  : "Esta clase ya pasó."}
            </div>
          ) : !choosing ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
                <InfoIcon className="mt-0.5 size-4 shrink-0 text-info" />
                <p className="text-muted-foreground">
                  ¿No puedes asistir? Mueve esta clase a otro día u hora <strong className="text-foreground">de esta misma semana</strong>,
                  siempre que haya cupos disponibles.
                </p>
              </div>
              <Button size="lg" className="w-full" onClick={() => setChoosing(true)}>
                <CalendarClockIcon /> Reagendar esta clase
              </Button>
            </div>
          ) : options.isError ? (
            <ErrorState error={options.error} onRetry={() => options.refetch()} />
          ) : !options.data ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-semibold">Elige el nuevo horario</p>
              {upcomingDays.length === 0 && (
                <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                  No quedan horarios disponibles esta semana.
                </p>
              )}
              {upcomingDays.map((day) => {
                const available = day.options.filter((o) => o.status === "available");
                return (
                  <div key={day.date} className={cn("space-y-2", (day.blockedReason || !available.length) && "opacity-60")}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {relativeDayLabel(day.date) ? `${relativeDayLabel(day.date)} · ` : ""}
                        {formatDateShort(day.date)}
                      </span>
                      {day.blockedReason && <span className="text-xs text-muted-foreground">{day.blockedReason}</span>}
                    </div>
                    {!day.blockedReason && (
                      <div className="grid grid-cols-2 gap-2">
                        {day.options.map((o) => {
                          const selected = target?.date === day.date && target.slotId === o.slotId;
                          const enabled = o.status === "available";
                          return (
                            <button
                              key={o.slotId}
                              type="button"
                              disabled={!enabled}
                              aria-pressed={selected}
                              onClick={() => setTarget({ date: day.date, slotId: o.slotId, startTime: o.startTime, endTime: o.endTime })}
                              className={cn(
                                "flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-all active:scale-[0.98]",
                                selected
                                  ? "border-foreground bg-foreground text-background shadow-md"
                                  : enabled
                                    ? "bg-card hover:border-foreground/40"
                                    : "cursor-not-allowed bg-muted/50 text-muted-foreground",
                              )}
                            >
                              <span className="text-sm font-semibold">{formatTime(o.startTime)}</span>
                              <span className={cn("text-xs", selected ? "text-background/70" : "text-muted-foreground")}>
                                {o.status === "current"
                                  ? "Tu clase actual"
                                  : o.status === "past"
                                    ? "No disponible"
                                    : o.status === "full"
                                      ? "Sin cupos"
                                      : `${o.available} ${o.available === 1 ? "cupo" : "cupos"}`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="sticky bottom-0 -mx-5 -mb-5 space-y-2 border-t bg-popover/95 p-5 backdrop-blur">
                {target ? (
                  <p className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground line-through">
                      {formatDateShort(klass.date)} {formatTime(klass.startTime)}
                    </span>
                    <ArrowRightIcon className="size-4" />
                    <strong>
                      {formatDateShort(target.date)} {formatTime(target.startTime)}
                    </strong>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Selecciona un horario disponible.</p>
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setChoosing(false)} disabled={reschedule.isPending}>
                    Volver
                  </Button>
                  <Button className="flex-1" disabled={!target || reschedule.isPending} onClick={confirm}>
                    {reschedule.isPending ? <Spinner /> : <CheckIcon />}
                    Confirmar cambio
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
