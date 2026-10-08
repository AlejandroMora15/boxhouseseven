"use client";

import { weekdayLabel } from "@/lib/constants";
import { isoWeekday, parseISODate, todayISO } from "@/lib/dates";
import type { AgendaWeek } from "@/lib/types";
import { cn } from "@/lib/utils";
import { occupancyLevel } from "@/components/common/occupancy";

const DOT: Record<string, string> = {
  empty: "bg-muted-foreground/25",
  low: "bg-success",
  medium: "bg-success",
  high: "bg-warning",
  full: "bg-destructive",
  over: "bg-destructive",
};

/** Tira de días de la semana para saltar rápido entre días. */
export function WeekStrip({
  dates,
  selected,
  onSelect,
  onHover,
  week,
}: {
  dates: string[];
  selected: string;
  onSelect: (date: string) => void;
  onHover?: (date: string) => void;
  week?: AgendaWeek;
}) {
  const today = todayISO();
  return (
    <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {dates.map((date) => {
        const day = week?.days.find((d) => d.date === date);
        const booked = day?.classes.reduce((acc, c) => acc + c.booked, 0) ?? 0;
        const capacity = day?.classes.reduce((acc, c) => acc + c.capacity, 0) ?? 0;
        const level = capacity ? occupancyLevel(booked, capacity) : "empty";
        const isSelected = date === selected;
        return (
          <button
            key={date}
            type="button"
            onClick={() => onSelect(date)}
            onMouseEnter={() => onHover?.(date)}
            onFocus={() => onHover?.(date)}
            aria-pressed={isSelected}
            aria-label={`${weekdayLabel(isoWeekday(date))} ${parseISODate(date).getDate()}`}
            className={cn(
              "relative flex min-w-[3.6rem] flex-1 flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition-all active:scale-95",
              isSelected
                ? "border-foreground bg-foreground text-background shadow-md"
                : "bg-card hover:border-foreground/30 hover:bg-accent",
              day?.closedReason && !isSelected && "bg-muted/60 text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "text-[0.68rem] font-semibold tracking-wider uppercase",
                isSelected ? "text-background/70" : "text-muted-foreground",
              )}
            >
              {weekdayLabel(isoWeekday(date), "short")}
            </span>
            <span className="font-heading text-2xl leading-none font-bold">{parseISODate(date).getDate()}</span>
            <span className="mt-0.5 flex h-1.5 items-center gap-1">
              {day?.closedReason ? (
                <span className="text-[0.6rem] font-semibold uppercase">Cerrado</span>
              ) : (
                <span className={cn("size-1.5 rounded-full", DOT[level])} />
              )}
            </span>
            {date === today && (
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-brand" aria-label="Hoy" />
            )}
          </button>
        );
      })}
    </div>
  );
}
