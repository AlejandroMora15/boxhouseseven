"use client";

import {
  CheckCheckIcon,
  CircleOffIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OriginBadge, Pill, PlanBadge } from "@/components/common/badges";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ContactButtons } from "@/components/common/contact-links";
import { OccupancyBar, OccupancyCount } from "@/components/common/occupancy";
import { PersonAvatar } from "@/components/common/person-avatar";
import { EmptyState } from "@/components/common/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRemoveFromClass, useSetAttendance, useSetClassAttendance } from "@/hooks/api/admin";
import { formatDateLong, formatDateShort, formatTime, formatTimeRange, todayISO } from "@/lib/dates";
import type { AgendaClass, RosterEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AddAttendeeDialog } from "./add-attendee-dialog";
import { AttendanceToggle } from "./attendance-toggle";
import { TimingPill } from "./slot-card";

function RosterItem({
  entry,
  klass,
  canMark,
  onRemove,
}: {
  entry: RosterEntry;
  klass: AgendaClass;
  canMark: boolean;
  onRemove: (entry: RosterEntry) => void;
}) {
  const setAttendance = useSetAttendance();

  return (
    <li className="flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <PersonAvatar name={entry.fullName} trial={entry.type === "trial"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate font-semibold">{entry.fullName}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <OriginBadge origin={entry.origin} />
            {entry.plan && <PlanBadge plan={entry.plan} />}
            {!entry.isActive && <Pill tone="neutral">Inactivo</Pill>}
            {entry.movedFrom && (
              <span className="text-xs text-muted-foreground">
                desde {formatDateShort(entry.movedFrom.date)} {formatTime(entry.movedFrom.startTime)}
              </span>
            )}
          </div>
        </div>
        <ContactButtons
          compact
          phone={entry.phone}
          email={entry.email}
          message={`Hola ${entry.fullName.split(" ")[0]}, te escribimos de Boxhouseseven.`}
        />
      </div>
      <div className="flex items-center justify-end gap-1.5 pl-12 sm:pl-0">
        {canMark ? (
          <AttendanceToggle
            value={entry.attendance}
            disabled={setAttendance.isPending}
            onChange={(status) =>
              setAttendance.mutate({
                date: klass.date,
                slotId: klass.slotId,
                status,
                ...(entry.type === "client" ? { clientId: entry.id } : { trialId: entry.id }),
              })
            }
          />
        ) : (
          <span className="text-xs text-muted-foreground">Asistencia pendiente</span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Más acciones para ${entry.fullName}`}>
              <EllipsisVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {entry.type === "client" ? (
              <>
                <DropdownMenuItem asChild>
                  <Link href={`/admin/clientes/${entry.id}`}>
                    <ExternalLinkIcon /> Ver cliente
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => onRemove(entry)}>
                  <UserMinusIcon /> Quitar de esta clase
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem asChild>
                <Link href={`/admin/pruebas?q=${encodeURIComponent(entry.document)}`}>
                  <ExternalLinkIcon /> Ver clase de prueba
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

/** Detalle de una clase: lista completa de asistentes y acciones del admin. */
export function ClassSheet({
  klass,
  open,
  onOpenChange,
  now,
  closedReason,
}: {
  klass: AgendaClass | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  now: number;
  closedReason: string | null;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [toRemove, setToRemove] = useState<RosterEntry | null>(null);
  const remove = useRemoveFromClass();
  const markAll = useSetClassAttendance();

  const existingIds = useMemo(
    () => new Set(klass?.attendees.filter((a) => a.type === "client").map((a) => a.id) ?? []),
    [klass],
  );

  if (!klass) return null;

  const canMark = klass.date <= todayISO();
  const present = klass.attendees.filter((a) => a.attendance === "present").length;
  const absent = klass.attendees.filter((a) => a.attendance === "absent").length;
  const clients = klass.attendees.filter((a) => a.type === "client");
  const trials = klass.attendees.filter((a) => a.type === "trial");

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
          aria-describedby={undefined}
        >
          <SheetHeader className="sticky top-0 z-10 gap-3 border-b bg-popover/95 p-5 backdrop-blur">
            <div className="flex items-center gap-2 pr-8">
              <TimingPill date={klass.date} startTime={klass.startTime} endTime={klass.endTime} now={now} />
              {closedReason && <Pill tone="danger">Cerrado: {closedReason}</Pill>}
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <SheetTitle className="text-display text-3xl leading-none">
                  {formatTimeRange(klass.startTime, klass.endTime)}
                </SheetTitle>
                <SheetDescription className="mt-1">{formatDateLong(klass.date)}</SheetDescription>
              </div>
              <OccupancyCount booked={klass.booked} capacity={klass.capacity} className="text-3xl" />
            </div>
            <OccupancyBar booked={klass.booked} capacity={klass.capacity} className="h-2" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{clients.length}</strong> clientes
              </span>
              <span>
                <strong className="text-foreground">{trials.length}</strong> en prueba
              </span>
              {canMark && (
                <>
                  <span>
                    <strong className="text-success">{present}</strong> asistieron
                  </span>
                  <span>
                    <strong className="text-destructive">{absent}</strong> faltaron
                  </span>
                </>
              )}
            </div>
          </SheetHeader>

          <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
            <Button onClick={() => setAddOpen(true)}>
              <UserPlusIcon /> Agregar asistente
            </Button>
            {canMark && klass.attendees.length > 0 && (
              <>
                <Button
                  variant="outline"
                  disabled={markAll.isPending}
                  onClick={() =>
                    markAll.mutate(
                      { date: klass.date, slotId: klass.slotId, status: "present" },
                      { onSuccess: () => toast.success("Todos marcados como asistentes.") },
                    )
                  }
                >
                  <CheckCheckIcon /> Todos asistieron
                </Button>
                <Button
                  variant="ghost"
                  disabled={markAll.isPending}
                  onClick={() =>
                    markAll.mutate(
                      { date: klass.date, slotId: klass.slotId, status: "absent" },
                      { onSuccess: () => toast.success("Todos marcados como ausentes.") },
                    )
                  }
                >
                  <CircleOffIcon /> Nadie vino
                </Button>
              </>
            )}
          </div>

          <div className="px-5 pb-8">
            {closedReason && (
              <Alert className="mt-4">
                <AlertDescription>
                  Este día está marcado como cerrado. Las personas inscritas no tendrán clase; avísales por WhatsApp.
                </AlertDescription>
              </Alert>
            )}
            {klass.attendees.length === 0 ? (
              <EmptyState
                className="mt-5"
                icon={<UsersIcon />}
                title="Nadie inscrito en esta clase"
                description="Puedes agregar manualmente a un cliente que asistió o que quiere entrenar en este horario."
              />
            ) : (
              <ul className={cn("divide-y")}>
                {klass.attendees.map((entry) => (
                  <RosterItem
                    key={`${entry.type}-${entry.id}`}
                    entry={entry}
                    klass={klass}
                    canMark={canMark}
                    onRemove={setToRemove}
                  />
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AddAttendeeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        date={klass.date}
        slotId={klass.slotId}
        startTime={klass.startTime}
        endTime={klass.endTime}
        existingIds={existingIds}
      />

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(o) => !o && setToRemove(null)}
        title={`¿Quitar a ${toRemove?.fullName ?? ""} de esta clase?`}
        description="Solo afecta esta fecha: su horario habitual no cambia. Si ya tenía asistencia marcada, se elimina."
        confirmLabel="Quitar de la clase"
        destructive
        onConfirm={async () => {
          if (!toRemove) return;
          await remove.mutateAsync({ date: klass.date, slotId: klass.slotId, clientId: toRemove.id });
          toast.success(`${toRemove.fullName} ya no está en esta clase.`);
        }}
      />
    </>
  );
}
