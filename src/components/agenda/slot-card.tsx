"use client";

import { ChevronRightIcon, SparklesIcon } from "lucide-react";
import { Pill } from "@/components/common/badges";
import { OccupancyBar, OccupancyCount } from "@/components/common/occupancy";
import { AvatarStack } from "@/components/common/person-avatar";
import { classTiming, timeUntil } from "@/lib/class-status";
import { formatTime } from "@/lib/dates";
import type { AgendaClass } from "@/lib/types";
import { cn } from "@/lib/utils";

function namesPreview(names: string[]): string {
  const first = names.map((n) => n.split(" ")[0]);
  if (first.length <= 3) return first.join(", ");
  return `${first.slice(0, 3).join(", ")} y ${first.length - 3} más`;
}

export function TimingPill({
  date,
  startTime,
  endTime,
  now,
}: {
  date: string;
  startTime: string;
  endTime: string;
  now: number;
}) {
  const timing = classTiming(date, startTime, endTime, now);
  if (timing === "live")
    return (
      <Pill tone="brand" icon={<span className="size-1.5 animate-pulse rounded-full bg-current" />}>
        En curso
      </Pill>
    );
  if (timing === "done") return <Pill tone="neutral">Finalizada</Pill>;
  return <Pill tone="neutral">{timeUntil(date, startTime, now)}</Pill>;
}

/** Tarjeta de una franja en la agenda del día. */
export function SlotCard({
  klass,
  now,
  onOpen,
}: {
  klass: AgendaClass;
  now: number;
  onOpen: () => void;
}) {
  const timing = classTiming(klass.date, klass.startTime, klass.endTime, now);
  const present = klass.attendees.filter((a) => a.attendance === "present").length;
  const attendees = klass.attendees;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex w-full items-stretch gap-3 text-left transition-all",
        timing === "done" && "opacity-80",
      )}
    >
      {/* Columna de hora (línea de tiempo) */}
      <div className="flex w-16 shrink-0 flex-col items-end pt-3 sm:w-20">
        <span className="font-heading text-lg leading-none font-bold sm:text-xl">
          {formatTime(klass.startTime).replace(/ (am|pm)$/, "")}
        </span>
        <span className="text-[0.7rem] font-semibold text-muted-foreground uppercase">
          {formatTime(klass.startTime).slice(-2)}
        </span>
      </div>

      <div
        className={cn(
          "relative flex min-w-0 flex-1 flex-col gap-2.5 rounded-xl border bg-card p-3.5 shadow-xs transition-all",
          "group-hover:-translate-y-0.5 group-hover:border-foreground/25 group-hover:shadow-md group-active:translate-y-0",
          timing === "live" && "border-brand/60 ring-2 ring-brand/15",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="hidden text-sm font-semibold whitespace-nowrap sm:inline">
              {formatTime(klass.startTime)} – {formatTime(klass.endTime)}
            </span>
            <TimingPill date={klass.date} startTime={klass.startTime} endTime={klass.endTime} now={now} />
          </div>
          <div className="flex items-center gap-1">
            <OccupancyCount booked={klass.booked} capacity={klass.capacity} />
            <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

        <OccupancyBar booked={klass.booked} capacity={klass.capacity} />

        {attendees.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin inscritos todavía</p>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <AvatarStack people={attendees} max={5} />
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              {namesPreview(attendees.map((a) => a.fullName))}
            </span>
          </div>
        )}

        {(klass.trials > 0 || present > 0 || klass.booked > klass.capacity) && (
          <div className="flex flex-wrap gap-1.5">
            {klass.trials > 0 && (
              <Pill tone="warning" icon={<SparklesIcon />}>
                {klass.trials} {klass.trials === 1 ? "prueba" : "pruebas"}
              </Pill>
            )}
            {present > 0 && (
              <Pill tone="success">
                {present} {present === 1 ? "asistió" : "asistieron"}
              </Pill>
            )}
            {klass.booked > klass.capacity && <Pill tone="danger">Sobrecupo</Pill>}
          </div>
        )}
      </div>
    </button>
  );
}
