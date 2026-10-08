"use client";

import { ClipboardListIcon, PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Planificación del día (resumen) con acceso a editarla. */
export function DayPlanCard({ date, plan }: { date: string; plan: { content: string } | null }) {
  const [expanded, setExpanded] = useState(false);
  const href = `/admin/clases?fecha=${date}`;

  if (!plan) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed bg-card/60 px-4 py-3">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <ClipboardListIcon className="size-4" />
          Sin planificación para este día.
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={href}>
            <PlusIcon /> Planificar
          </Link>
        </Button>
      </div>
    );
  }

  const long = plan.content.length > 180 || plan.content.split("\n").length > 3;
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          <ClipboardListIcon className="size-4 text-brand" /> Plan del día
        </span>
        <Button variant="ghost" size="sm" asChild>
          <Link href={href}>
            <PencilIcon /> Editar
          </Link>
        </Button>
      </div>
      <p className={cn("text-sm whitespace-pre-line", !expanded && "line-clamp-3")}>{plan.content}</p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {expanded ? "Ver menos" : "Ver todo"}
        </button>
      )}
    </div>
  );
}
