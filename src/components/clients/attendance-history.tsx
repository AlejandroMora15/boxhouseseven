"use client";

import { CalendarCheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { AttendanceBadge } from "@/components/common/badges";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { addMonthsISO, formatDateLong, formatMonth, formatTimeRange, startOfMonthISO, todayISO } from "@/lib/dates";
import type { AttendanceHistory } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Historial mensual de asistencia (lo usan el admin y el propio cliente). */
export function AttendanceHistoryPanel({
  month,
  onMonthChange,
  query,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  query: {
    data?: AttendanceHistory;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
    isPlaceholderData: boolean;
  };
}) {
  const current = startOfMonthISO(todayISO());
  const isCurrent = month >= current;
  const data = query.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onMonthChange(addMonthsISO(month, -1))}
          aria-label="Mes anterior"
        >
          <ChevronLeftIcon />
        </Button>
        <div className="text-center">
          <div className="font-heading text-lg font-semibold">{formatMonth(month)}</div>
          {!isCurrent && (
            <button
              type="button"
              onClick={() => onMonthChange(current)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Ir al mes actual
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onMonthChange(addMonthsISO(month, 1))}
          disabled={isCurrent}
          aria-label="Mes siguiente"
        >
          <ChevronRightIcon />
        </Button>
      </div>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !data ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className={cn("space-y-4 transition-opacity", query.isPlaceholderData && "opacity-60")}>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-success/10 p-3 text-center">
              <div className="font-heading text-2xl font-bold text-success">{data.summary.present}</div>
              <div className="text-xs text-muted-foreground">Asistencias</div>
            </div>
            <div className="rounded-xl bg-destructive/8 p-3 text-center">
              <div className="font-heading text-2xl font-bold text-destructive">{data.summary.absent}</div>
              <div className="text-xs text-muted-foreground">Faltas</div>
            </div>
            <div className="rounded-xl bg-muted p-3 text-center">
              <div className="font-heading text-2xl font-bold">
                {data.summary.rate === null ? "—" : `${data.summary.rate}%`}
              </div>
              <div className="text-xs text-muted-foreground">Cumplimiento</div>
            </div>
          </div>

          {data.items.length === 0 ? (
            <EmptyState
              icon={<CalendarCheckIcon />}
              title="Sin registros este mes"
              description="Aquí aparecen las clases con asistencia marcada por el administrador."
            />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {data.items.map((item) => (
                <li key={`${item.date}-${item.slotId}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{formatDateLong(item.date)}</div>
                    <div className="text-xs text-muted-foreground">{formatTimeRange(item.startTime, item.endTime)}</div>
                  </div>
                  <AttendanceBadge status={item.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
