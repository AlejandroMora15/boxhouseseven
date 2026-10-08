import { cn } from "@/lib/utils";

export type OccupancyLevel = "empty" | "low" | "medium" | "high" | "full" | "over";

export function occupancyLevel(booked: number, capacity: number): OccupancyLevel {
  if (booked === 0) return "empty";
  if (booked > capacity) return "over";
  if (booked === capacity) return "full";
  const ratio = booked / capacity;
  if (ratio >= 0.7) return "high";
  if (ratio >= 0.4) return "medium";
  return "low";
}

const BAR: Record<OccupancyLevel, string> = {
  empty: "bg-muted-foreground/30",
  low: "bg-success",
  medium: "bg-success",
  high: "bg-warning",
  full: "bg-destructive",
  over: "bg-destructive",
};

export const OCCUPANCY_TEXT: Record<OccupancyLevel, string> = {
  empty: "text-muted-foreground",
  low: "text-success",
  medium: "text-success",
  high: "text-[color-mix(in_oklch,var(--warning),black_25%)] dark:text-warning",
  full: "text-destructive",
  over: "text-destructive",
};

export function OccupancyBar({
  booked,
  capacity,
  className,
}: {
  booked: number;
  capacity: number;
  className?: string;
}) {
  const level = occupancyLevel(booked, capacity);
  const pct = Math.min(100, Math.round((booked / Math.max(capacity, 1)) * 100));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={capacity}
      aria-valuenow={booked}
      aria-label={`${booked} de ${capacity} cupos ocupados`}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", BAR[level])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function OccupancyCount({
  booked,
  capacity,
  className,
}: {
  booked: number;
  capacity: number;
  className?: string;
}) {
  const level = occupancyLevel(booked, capacity);
  return (
    <span className={cn("font-heading text-xl font-bold tabular-nums", OCCUPANCY_TEXT[level], className)}>
      {booked}
      <span className="text-sm font-semibold text-muted-foreground">/{capacity}</span>
    </span>
  );
}
