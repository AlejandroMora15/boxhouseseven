"use client";

import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CreditCardIcon,
  PencilIcon,
  PowerIcon,
  PowerOffIcon,
  SparklesIcon,
  StickyNoteIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ActiveBadge, AttendanceBadge, OriginBadge, PlanBadge } from "@/components/common/badges";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ContactButtons } from "@/components/common/contact-links";
import { PersonAvatar } from "@/components/common/person-avatar";
import { WeekdayDots } from "@/components/common/schedule-summary";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useClient,
  useClientHistory,
  useDeleteClient,
  useSetClientStatus,
} from "@/hooks/api/admin";
import { PLANS, weekdayLabel } from "@/lib/constants";
import {
  formatDateCompact,
  formatDateLong,
  formatTimeRange,
  relativeDayLabel,
  startOfMonthISO,
  todayISO,
} from "@/lib/dates";
import { formatCOP, formatDocument, formatPhone } from "@/lib/format";
import { AttendanceHistoryPanel } from "./attendance-history";

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export function ClientDetailView({ id }: { id: string }) {
  const router = useRouter();
  const client = useClient(id);
  const [month, setMonth] = useState(() => startOfMonthISO(todayISO()));
  const history = useClientHistory(id, month);
  const setStatus = useSetClientStatus();
  const remove = useDeleteClient();

  if (client.isError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/admin/clientes">
            <ArrowLeftIcon /> Clientes
          </Link>
        </Button>
        <ErrorState error={client.error} onRetry={() => client.refetch()} />
      </div>
    );
  }

  if (!client.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    );
  }

  const c = client.data;

  return (
    <div className="space-y-5">
      <Button variant="ghost" asChild className="-ml-3">
        <Link href="/admin/clientes">
          <ArrowLeftIcon /> Clientes
        </Link>
      </Button>

      {/* Encabezado */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
        <PersonAvatar name={c.fullName} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-display truncate text-3xl leading-tight">{c.fullName}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <ActiveBadge isActive={c.isActive} />
            <PlanBadge plan={c.plan} />
            {c.trial && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <SparklesIcon className="size-3" /> Vino de clase de prueba ({formatDateCompact(c.trial.classDate)})
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/admin/clientes/${c.id}/editar`}>
              <PencilIcon /> Editar
            </Link>
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="outline">
                {c.isActive ? <PowerOffIcon /> : <PowerIcon />}
                {c.isActive ? "Inactivar" : "Activar"}
              </Button>
            }
            title={c.isActive ? `¿Inactivar a ${c.fullName}?` : `¿Activar a ${c.fullName}?`}
            description={
              c.isActive
                ? "Dejará de contar en las clases y no podrá iniciar sesión hasta que lo actives de nuevo. Su historial se conserva."
                : "Volverá a aparecer en sus clases según su horario y podrá iniciar sesión."
            }
            confirmLabel={c.isActive ? "Inactivar" : "Activar"}
            onConfirm={async () => {
              await setStatus.mutateAsync({ id: c.id, isActive: !c.isActive });
              toast.success(c.isActive ? "Cliente inactivado." : "Cliente activado.");
            }}
          />
          <ConfirmDialog
            trigger={
              <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2Icon /> Eliminar
              </Button>
            }
            title={`¿Eliminar a ${c.fullName}?`}
            description="Se borrarán sus datos, horario e historial de asistencia. Esta acción no se puede deshacer. Si solo dejó de venir, mejor inactívalo."
            confirmLabel="Eliminar definitivamente"
            destructive
            onConfirm={async () => {
              await remove.mutateAsync(c.id);
              toast.success("Cliente eliminado.");
              router.replace("/admin/clientes");
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Contacto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-display text-lg">Contacto</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <InfoRow label="Documento">{formatDocument(c.document)}</InfoRow>
            <InfoRow label="Celular">{formatPhone(c.phone)}</InfoRow>
            <InfoRow label="Correo">
              <span className="break-all">{c.email}</span>
            </InfoRow>
            <div className="flex items-center justify-between pt-3">
              <span className="text-xs text-muted-foreground">Cliente desde {formatDateCompact(c.startDate)}</span>
              <ContactButtons phone={c.phone} email={c.email} message={`Hola ${c.fullName.split(" ")[0]}!`} />
            </div>
          </CardContent>
        </Card>

        {/* Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-display text-lg">
              <CreditCardIcon className="size-4" /> Mensualidad
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <InfoRow label="Modalidad">{PLANS[c.plan].label}</InfoRow>
            <InfoRow label="Valor mensual">{formatCOP(c.monthlyFee)}</InfoRow>
            <InfoRow label="Fecha de inicio">{formatDateCompact(c.startDate)}</InfoRow>
          </CardContent>
        </Card>

        {/* Horario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-display text-lg">
              <CalendarClockIcon className="size-4" /> Horario semanal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <WeekdayDots days={c.schedule.map((s) => s.weekday)} />
            <ul className="divide-y text-sm">
              {c.schedule.map((s) => (
                <li key={s.weekday} className="flex justify-between py-2">
                  <span className="font-medium">{weekdayLabel(s.weekday)}</span>
                  <span className="text-muted-foreground">{formatTimeRange(s.startTime, s.endTime)}</span>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2 pt-1 text-center">
              <div className="rounded-lg bg-muted p-2">
                <div className="font-heading text-xl font-bold">{c.stats.monthPresent}</div>
                <div className="text-[0.7rem] text-muted-foreground">asistencias este mes</div>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <div className="font-heading text-xl font-bold">
                  {c.stats.lastAttendance ? (relativeDayLabel(c.stats.lastAttendance) ?? formatDateCompact(c.stats.lastAttendance)) : "—"}
                </div>
                <div className="text-[0.7rem] text-muted-foreground">última asistencia</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-display text-lg">Próximas clases</CardTitle>
          </CardHeader>
          <CardContent>
            {!c.isActive ? (
              <p className="text-sm text-muted-foreground">El cliente está inactivo: no tiene clases programadas.</p>
            ) : c.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tiene clases en los próximos días.</p>
            ) : (
              <ul className="space-y-2">
                {c.upcoming.map((u) => (
                  <li key={`${u.date}-${u.slotId}`}>
                    <Link
                      href={`/admin/agenda?fecha=${u.date}&clase=${u.slotId}`}
                      className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {relativeDayLabel(u.date) ?? formatDateLong(u.date)}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatTimeRange(u.startTime, u.endTime)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {u.closedReason ? <span className="text-xs text-destructive">Cerrado</span> : <OriginBadge origin={u.origin} />}
                        {u.attendance && <AttendanceBadge status={u.attendance} />}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {c.notes && (
              <div className="mt-4 flex gap-2 rounded-lg bg-warning/10 p-3 text-sm">
                <StickyNoteIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                <p className="whitespace-pre-line">{c.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-display text-lg">Historial de asistencia</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceHistoryPanel month={month} onMonthChange={setMonth} query={history} />
          </CardContent>
        </Card>
      </div>
      {!c.schedule.length && (
        <EmptyState title="Sin horario" description="Edita el cliente para asignarle días y hora." />
      )}
    </div>
  );
}
