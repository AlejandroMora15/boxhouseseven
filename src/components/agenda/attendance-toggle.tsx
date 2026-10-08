"use client";

import { CheckIcon, XIcon } from "lucide-react";
import type { AttendanceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Control segmentado Asistió / Faltó (tocar de nuevo limpia el registro). */
export function AttendanceToggle({
  value,
  onChange,
  disabled,
  size = "md",
}: {
  value: AttendanceStatus | null;
  onChange: (value: AttendanceStatus | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center justify-center gap-1 font-semibold transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";
  const height = size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm";
  return (
    <div role="group" aria-label="Asistencia" className="inline-flex shrink-0 overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === "present"}
        onClick={() => onChange(value === "present" ? null : "present")}
        className={cn(
          base,
          height,
          value === "present" ? "bg-success text-white" : "text-muted-foreground hover:bg-success/10 hover:text-success",
        )}
      >
        <CheckIcon className="size-4" />
        Asistió
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === "absent"}
        onClick={() => onChange(value === "absent" ? null : "absent")}
        className={cn(
          base,
          height,
          "border-l",
          value === "absent"
            ? "bg-destructive text-white"
            : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
        )}
      >
        <XIcon className="size-4" />
        Faltó
      </button>
    </div>
  );
}
