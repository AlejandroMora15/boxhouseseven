"use client";

import { es } from "date-fns/locale";
import { CalendarSearchIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseISODate, toISODate, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Selector "Ir a fecha": calendario en popover para saltar a cualquier día. */
export function JumpToDate({
  value,
  onChange,
  label = "Ir a fecha",
  trigger,
  className,
  disabled,
}: {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  trigger?: ReactNode;
  className?: string;
  disabled?: (date: Date) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className={cn("gap-2", className)} aria-label={label}>
            <CalendarSearchIcon />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          locale={es}
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          startMonth={new Date(2024, 0)}
          endMonth={new Date(new Date().getFullYear() + 2, 11)}
          weekStartsOn={1}
          disabled={disabled}
          className="[--cell-size:--spacing(9)]"
          modifiers={{ today: parseISODate(todayISO()) }}
          onSelect={(date) => {
            if (!date) return;
            onChange(toISODate(date));
            setOpen(false);
          }}
        />
        <div className="flex justify-between gap-2 border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(todayISO());
              setOpen(false);
            }}
          >
            Hoy
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
