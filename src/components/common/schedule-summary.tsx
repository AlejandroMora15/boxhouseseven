import { weekdayLabel } from "@/lib/constants";
import { formatTime } from "@/lib/dates";
import type { ScheduleEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Resume el horario semanal: "Lun · Mié · Vie — 6:00 am" o, si las horas
 * varían, una línea por grupo de días con la misma hora.
 */
export function scheduleGroups(schedule: ScheduleEntry[]) {
  const groups = new Map<string, { startTime: string; days: number[] }>();
  for (const entry of [...schedule].sort((a, b) => a.weekday - b.weekday)) {
    const group = groups.get(entry.startTime) ?? { startTime: entry.startTime, days: [] };
    group.days.push(entry.weekday);
    groups.set(entry.startTime, group);
  }
  return [...groups.values()].sort((a, b) => a.days[0] - b.days[0]);
}

export function ScheduleSummary({
  schedule,
  className,
  compact,
}: {
  schedule: ScheduleEntry[];
  className?: string;
  compact?: boolean;
}) {
  if (!schedule.length) return <span className="text-muted-foreground">Sin horario</span>;
  const groups = scheduleGroups(schedule);
  return (
    <span className={cn("inline-flex flex-col gap-0.5", className)}>
      {groups.map((g) => (
        <span key={g.startTime} className="whitespace-nowrap">
          <span className="font-medium">
            {g.days.length === 5 && !compact ? "Lun a Vie" : g.days.map((d) => weekdayLabel(d, "short")).join(" · ")}
          </span>
          <span className="text-muted-foreground"> — {formatTime(g.startTime)}</span>
        </span>
      ))}
    </span>
  );
}

/** Indicador de días L M X J V con los días activos resaltados. */
export function WeekdayDots({ days, className }: { days: number[]; className?: string }) {
  return (
    <span className={cn("inline-flex gap-1", className)} aria-label={days.map((d) => weekdayLabel(d)).join(", ")}>
      {[1, 2, 3, 4, 5, 6, 7].filter((d) => d <= 5 || days.includes(d)).map((d) => (
        <span
          key={d}
          className={cn(
            "inline-flex size-5 items-center justify-center rounded text-[0.6rem] font-bold",
            days.includes(d) ? "bg-foreground text-background" : "bg-muted text-muted-foreground/60",
          )}
        >
          {weekdayLabel(d, "letter")}
        </span>
      ))}
    </span>
  );
}
