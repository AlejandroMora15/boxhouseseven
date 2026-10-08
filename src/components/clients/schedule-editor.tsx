"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TRAINING_WEEKDAYS, weekdayLabel, type Plan } from "@/lib/constants";
import { formatTimeRange } from "@/lib/dates";
import type { ScheduleEntryInput } from "@/lib/schemas";
import type { TimeSlotWithUsage } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_THREE_DAYS = [1, 3, 5];

/** Ajusta el horario cuando cambia el plan (diario = L-V; 3 días = 3 días). */
export function scheduleForPlan(plan: Plan, current: ScheduleEntryInput[], slots: TimeSlotWithUsage[]) {
  const fallbackSlot = current[0]?.slotId ?? slots[0]?.id ?? 0;
  const slotFor = (weekday: number) => current.find((c) => c.weekday === weekday)?.slotId ?? fallbackSlot;
  const days =
    plan === "daily"
      ? [...TRAINING_WEEKDAYS]
      : current.length === 3
        ? current.map((c) => c.weekday)
        : current.length > 3
          ? current.slice(0, 3).map((c) => c.weekday)
          : DEFAULT_THREE_DAYS;
  return days.map((weekday) => ({ weekday, slotId: slotFor(weekday) }));
}

/**
 * Editor del horario semanal de un cliente: días según el plan y franja por
 * día, mostrando cuántos clientes ya tienen esa franja (para no sobrecargar).
 */
export function ScheduleEditor({
  plan,
  value,
  onChange,
  slots,
  capacity,
  original = [],
  invalid,
}: {
  plan: Plan;
  value: ScheduleEntryInput[];
  onChange: (value: ScheduleEntryInput[]) => void;
  slots: TimeSlotWithUsage[];
  capacity: number;
  /** Horario guardado del cliente (para no contarlo dos veces al editar). */
  original?: ScheduleEntryInput[];
  invalid?: boolean;
}) {
  const varied = new Set(value.map((v) => v.slotId)).size > 1;
  const [perDay, setPerDay] = useState(varied);
  const days = value.map((v) => v.weekday).sort((a, b) => a - b);
  const uniformSlot = value[0]?.slotId;

  /** Clientes (activos) con esa franja ese día, sin contar a este cliente. */
  const usage = (slot: TimeSlotWithUsage, weekday: number) => {
    const base = slot.clientsByWeekday[weekday] ?? 0;
    const mine = original.some((o) => o.weekday === weekday && o.slotId === slot.id) ? 1 : 0;
    return base - mine;
  };

  function toggleDay(weekday: number) {
    if (plan === "daily") return;
    if (days.includes(weekday)) {
      onChange(value.filter((v) => v.weekday !== weekday));
    } else if (value.length < 3) {
      const slotId = uniformSlot ?? slots.find((s) => s.weekdays.includes(weekday))?.id ?? 0;
      onChange([...value, { weekday, slotId }].sort((a, b) => a.weekday - b.weekday));
    }
  }

  function setAll(slotId: number) {
    onChange(value.map((v) => ({ ...v, slotId })));
  }

  function setDay(weekday: number, slotId: number) {
    onChange(value.map((v) => (v.weekday === weekday ? { ...v, slotId } : v)));
  }

  const fullWarnings = value
    .map((v) => {
      const slot = slots.find((s) => s.id === v.slotId);
      if (!slot) return null;
      const n = usage(slot, v.weekday) + 1;
      return n > capacity ? `${weekdayLabel(v.weekday)} ${formatTimeRange(slot.startTime, slot.endTime)}` : null;
    })
    .filter(Boolean);

  const slotLabel = (slot: TimeSlotWithUsage, forDays: number[]) => {
    const max = Math.max(0, ...forDays.map((d) => usage(slot, d)));
    return (
      <span className="flex w-full items-center justify-between gap-3">
        <span>{formatTimeRange(slot.startTime, slot.endTime)}</span>
        <span
          className={cn(
            "text-xs tabular-nums",
            max >= capacity ? "font-semibold text-destructive" : max >= capacity * 0.7 ? "text-warning" : "text-muted-foreground",
          )}
        >
          {max}/{capacity}
        </span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">
          Días de asistencia{" "}
          <span className="font-normal text-muted-foreground">
            {plan === "daily" ? "(lunes a viernes)" : `(${value.length}/3 seleccionados)`}
          </span>
        </Label>
        <div className="flex gap-2" role="group" aria-label="Días de asistencia">
          {TRAINING_WEEKDAYS.map((d) => {
            const selected = days.includes(d);
            const blocked = plan === "three_days" && !selected && value.length >= 3;
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                disabled={plan === "daily" || blocked}
                aria-pressed={selected}
                className={cn(
                  "flex h-12 flex-1 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition-all active:scale-95",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  plan === "daily" && "cursor-default active:scale-100",
                  blocked && "opacity-40",
                )}
              >
                <span className="text-[0.65rem] tracking-wider uppercase opacity-70">{weekdayLabel(d, "letter")}</span>
                {weekdayLabel(d, "short")}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="per-day" className="font-normal text-muted-foreground">
          Horario distinto según el día
        </Label>
        <Switch
          id="per-day"
          checked={perDay}
          onCheckedChange={(checked) => {
            setPerDay(checked);
            if (!checked && uniformSlot) setAll(uniformSlot);
          }}
        />
      </div>

      {!perDay ? (
        <div className="space-y-2">
          <Label>Horario</Label>
          <Select
            value={uniformSlot ? String(uniformSlot) : undefined}
            onValueChange={(v) => setAll(Number(v))}
            disabled={!value.length}
          >
            <SelectTrigger className="w-full" aria-invalid={invalid}>
              <SelectValue placeholder="Selecciona la hora de clase" />
            </SelectTrigger>
            <SelectContent>
              {slots
                .filter((s) => days.every((d) => s.weekdays.includes(d)))
                .map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {slotLabel(s, days)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">El número indica cuántos clientes tienen ya ese horario.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {value.map((entry) => (
            <div key={entry.weekday} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-sm font-semibold">{weekdayLabel(entry.weekday, "short")}</span>
              <Select value={entry.slotId ? String(entry.slotId) : undefined} onValueChange={(v) => setDay(entry.weekday, Number(v))}>
                <SelectTrigger className="w-full" aria-label={`Horario del ${weekdayLabel(entry.weekday)}`}>
                  <SelectValue placeholder="Hora" />
                </SelectTrigger>
                <SelectContent>
                  {slots
                    .filter((s) => s.weekdays.includes(entry.weekday))
                    .map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {slotLabel(s, [entry.weekday])}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      {fullWarnings.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/12 px-3 py-2 text-xs text-[color-mix(in_oklch,var(--warning),black_35%)] dark:text-warning">
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
          Con este cliente se supera el cupo de {capacity} en: {fullWarnings.join(", ")}. Puedes guardarlo igual,
          pero esas clases quedarán con sobrecupo.
        </p>
      )}
    </div>
  );
}
