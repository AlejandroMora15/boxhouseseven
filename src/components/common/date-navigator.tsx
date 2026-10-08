"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { JumpToDate } from "./jump-to-date";

/**
 * Navegación de calendario: anterior / siguiente / hoy + "ir a fecha".
 * Se usa para días, semanas y meses (el padre decide el paso).
 */
export function DateNavigator({
  value,
  label,
  sublabel,
  onPrev,
  onNext,
  onToday,
  onJump,
  isCurrent,
  prevLabel = "Anterior",
  nextLabel = "Siguiente",
  todayLabel = "Hoy",
  className,
}: {
  value: string;
  label: ReactNode;
  sublabel?: ReactNode;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onJump: (iso: string) => void;
  isCurrent: boolean;
  prevLabel?: string;
  nextLabel?: string;
  todayLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center rounded-lg border bg-card shadow-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onPrev} aria-label={prevLabel} className="rounded-r-none">
              <ChevronLeftIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{prevLabel}</TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          onClick={onToday}
          disabled={isCurrent}
          className="rounded-none border-x px-3 font-semibold disabled:opacity-100 disabled:text-muted-foreground"
        >
          {todayLabel}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onNext} aria-label={nextLabel} className="rounded-l-none">
              <ChevronRightIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{nextLabel}</TooltipContent>
        </Tooltip>
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate font-heading text-lg font-semibold sm:text-xl">{label}</div>
        {sublabel && <div className="truncate text-xs text-muted-foreground">{sublabel}</div>}
      </div>
      <JumpToDate value={value} onChange={onJump} />
    </div>
  );
}
