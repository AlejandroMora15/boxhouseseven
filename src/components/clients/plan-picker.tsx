"use client";

import { CalendarDaysIcon, CalendarRangeIcon, CheckIcon } from "lucide-react";
import { PLAN_OPTIONS, PLANS, type Plan } from "@/lib/constants";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Selección de modalidad con tarjetas grandes (precio incluido). */
export function PlanPicker({
  value,
  onChange,
  prices,
}: {
  value: Plan;
  onChange: (plan: Plan) => void;
  prices: Record<Plan, number>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Modalidad">
      {PLAN_OPTIONS.map((plan) => {
        const selected = value === plan;
        const Icon = plan === "daily" ? CalendarDaysIcon : CalendarRangeIcon;
        return (
          <button
            key={plan}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(plan)}
            className={cn(
              "relative flex items-center gap-3 rounded-xl border-2 bg-card p-4 text-left transition-all active:scale-[0.99]",
              selected ? "border-foreground shadow-md" : "border-border hover:border-foreground/30",
            )}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                selected ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{PLANS[plan].label}</span>
              <span className="block text-sm text-muted-foreground">{formatCOP(prices[plan])} / mes</span>
            </span>
            {selected && (
              <span className="flex size-5 items-center justify-center rounded-full bg-brand text-white animate-pop-in">
                <CheckIcon className="size-3.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
