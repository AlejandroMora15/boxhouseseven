import {
  ArrowRightLeftIcon,
  CheckIcon,
  CircleDashedIcon,
  HistoryIcon,
  PlusIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { PLANS, type Plan } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import type { AttendanceStatus, EntryOrigin, TrialStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "violet" | "brand" | "dark";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  success: "bg-success/12 text-success ring-success/25",
  warning: "bg-warning/15 text-[color-mix(in_oklch,var(--warning),black_25%)] ring-warning/30 dark:text-warning",
  danger: "bg-destructive/10 text-destructive ring-destructive/25",
  info: "bg-info/10 text-info ring-info/25",
  violet: "bg-violet/10 text-violet ring-violet/25",
  brand: "bg-brand text-brand-foreground ring-brand",
  dark: "bg-foreground text-background ring-foreground",
};

export function Pill({
  tone = "neutral",
  icon,
  children,
  className,
  title,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5.5 shrink-0 items-center gap-1 rounded-full px-2 text-[0.72rem] font-semibold whitespace-nowrap ring-1 ring-inset [&>svg]:size-3",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Pill tone="success" icon={<span className="size-1.5 rounded-full bg-current" />}>
      Activo
    </Pill>
  ) : (
    <Pill tone="neutral" icon={<span className="size-1.5 rounded-full bg-current" />}>
      Inactivo
    </Pill>
  );
}

export function PlanBadge({ plan, className }: { plan: Plan; className?: string }) {
  return (
    <Pill tone={plan === "daily" ? "dark" : "neutral"} className={className}>
      {PLANS[plan].short}
    </Pill>
  );
}

export function AttendanceBadge({ status }: { status: AttendanceStatus | null }) {
  if (status === "present")
    return (
      <Pill tone="success" icon={<CheckIcon />}>
        Asistió
      </Pill>
    );
  if (status === "absent")
    return (
      <Pill tone="danger" icon={<XIcon />}>
        No asistió
      </Pill>
    );
  return (
    <Pill tone="neutral" icon={<CircleDashedIcon />}>
      Sin registrar
    </Pill>
  );
}

export function OriginBadge({ origin }: { origin: EntryOrigin }) {
  switch (origin) {
    case "trial":
      return (
        <Pill tone="warning" icon={<SparklesIcon />}>
          Prueba
        </Pill>
      );
    case "reschedule":
      return (
        <Pill tone="info" icon={<ArrowRightLeftIcon />}>
          Reagendado
        </Pill>
      );
    case "admin":
      return (
        <Pill tone="violet" icon={<PlusIcon />}>
          Agregado
        </Pill>
      );
    case "attendance":
      return (
        <Pill tone="neutral" icon={<HistoryIcon />}>
          Registro
        </Pill>
      );
    default:
      return null;
  }
}

export function TrialStatusBadge({
  status,
  attendance,
  classDate,
}: {
  status: TrialStatus;
  attendance: AttendanceStatus | null;
  classDate: string;
}) {
  if (status === "converted") return <Pill tone="success">Ya es cliente</Pill>;
  if (status === "cancelled") return <Pill tone="neutral">Cancelada</Pill>;
  if (attendance === "present") return <Pill tone="info">Asistió</Pill>;
  if (attendance === "absent") return <Pill tone="danger">No asistió</Pill>;
  if (classDate < todayISO()) return <Pill tone="neutral">Pendiente de registro</Pill>;
  return <Pill tone="warning">Agendada</Pill>;
}
