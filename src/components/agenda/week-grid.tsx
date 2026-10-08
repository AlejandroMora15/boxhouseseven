"use client";

import { SparklesIcon } from "lucide-react";
import { OCCUPANCY_TEXT, occupancyLevel } from "@/components/common/occupancy";
import { weekdayLabel } from "@/lib/constants";
import { formatTime, isoWeekday, parseISODate, todayISO } from "@/lib/dates";
import type { AgendaWeek } from "@/lib/types";
import { cn } from "@/lib/utils";

const CELL_BG: Record<string, string> = {
  empty: "bg-card",
  low: "bg-success/8",
  medium: "bg-success/15",
  high: "bg-warning/20",
  full: "bg-destructive/15",
  over: "bg-destructive/25",
};

/** Vista semanal: ocupación de cada franja por día, de un vistazo. */
export function WeekGrid({
  week,
  onOpenClass,
  onOpenDay,
}: {
  week: AgendaWeek;
  onOpenClass: (date: string, slotId: number) => void;
  onOpenDay: (date: string) => void;
}) {
  const today = todayISO();
  const slotIds = [...new Set(week.days.flatMap((d) => d.classes.map((c) => c.slotId)))];
  const slots = slotIds
    .map((id) => {
      const sample = week.days.flatMap((d) => d.classes).find((c) => c.slotId === id)!;
      return { id, startTime: sample.startTime, endTime: sample.endTime };
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[640px] border-separate border-spacing-1.5 text-sm">
        <thead>
          <tr>
            <th className="w-20" />
            {week.days.map((day) => (
              <th key={day.date} className="p-0 font-normal">
                <button
                  type="button"
                  onClick={() => onOpenDay(day.date)}
                  className={cn(
                    "flex w-full flex-col items-center rounded-lg py-1.5 transition-colors hover:bg-accent",
                    day.date === today && "bg-foreground text-background hover:bg-foreground/90",
                  )}
                >
                  <span className="text-[0.68rem] font-semibold tracking-wider uppercase opacity-70">
                    {weekdayLabel(isoWeekday(day.date), "short")}
                  </span>
                  <span className="font-heading text-xl leading-none font-bold">
                    {parseISODate(day.date).getDate()}
                  </span>
                  {day.closedReason && (
                    <span className="mt-0.5 text-[0.6rem] font-semibold text-destructive uppercase">Cerrado</span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot.id}>
              <th scope="row" className="pr-1 text-right align-middle font-heading text-base font-semibold whitespace-nowrap">
                {formatTime(slot.startTime)}
              </th>
              {week.days.map((day) => {
                const c = day.classes.find((x) => x.slotId === slot.id);
                if (!c) return <td key={day.date} className="rounded-lg bg-muted/40" />;
                const level = occupancyLevel(c.booked, c.capacity);
                return (
                  <td key={day.date} className="p-0">
                    <button
                      type="button"
                      onClick={() => onOpenClass(day.date, slot.id)}
                      className={cn(
                        "flex h-14 w-full flex-col items-center justify-center rounded-lg border transition-all hover:-translate-y-0.5 hover:shadow-md",
                        CELL_BG[level],
                        day.closedReason && "opacity-50",
                      )}
                      aria-label={`${weekdayLabel(isoWeekday(day.date))} ${formatTime(slot.startTime)}: ${c.booked} de ${c.capacity}`}
                    >
                      <span className={cn("font-heading text-lg leading-none font-bold tabular-nums", OCCUPANCY_TEXT[level])}>
                        {c.booked}
                        <span className="text-xs font-semibold text-muted-foreground">/{c.capacity}</span>
                      </span>
                      {c.trials > 0 && (
                        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[0.65rem] font-semibold text-[color-mix(in_oklch,var(--warning),black_25%)] dark:text-warning">
                          <SparklesIcon className="size-3" />
                          {c.trials}
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-success/15 ring-1 ring-success/30" /> Con cupos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-warning/25 ring-1 ring-warning/40" /> Casi lleno
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-destructive/20 ring-1 ring-destructive/30" /> Lleno
        </span>
        <span className="flex items-center gap-1.5">
          <SparklesIcon className="size-3 text-warning" /> Clases de prueba
        </span>
      </div>
    </div>
  );
}
