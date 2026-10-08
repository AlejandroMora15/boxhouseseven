"use client";

import { ClockIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { WeekdayDots } from "@/components/common/schedule-summary";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useDeleteSlot, useSaveSlot, useSlots } from "@/hooks/api/admin";
import { ApiError } from "@/lib/api-client";
import { WEEKDAYS } from "@/lib/constants";
import { formatTimeRange } from "@/lib/dates";
import { slotInputSchema } from "@/lib/schemas";
import type { TimeSlotWithUsage } from "@/lib/types";
import { cn } from "@/lib/utils";

function SlotDialog({
  open,
  onOpenChange,
  slot,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: TimeSlotWithUsage | null;
}) {
  const save = useSaveSlot();
  const [startTime, setStart] = useState(slot?.startTime ?? "06:00");
  const [endTime, setEnd] = useState(slot?.endTime ?? "07:00");
  const [weekdays, setWeekdays] = useState<number[]>(slot?.weekdays ?? [1, 2, 3, 4, 5]);
  const [error, setError] = useState<string | null>(null);

  function onStartChange(value: string) {
    setStart(value);
    // Propone una clase de 1 hora.
    const [h, m] = value.split(":").map(Number);
    if (!Number.isNaN(h) && h < 23) setEnd(`${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = slotInputSchema.safeParse({ startTime, endTime, weekdays });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
      return;
    }
    try {
      await save.mutateAsync({ id: slot?.id, input: parsed.data });
      toast.success(slot ? "Horario actualizado." : "Horario creado.");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{slot ? "Editar horario" : "Nuevo horario de clase"}</DialogTitle>
          <DialogDescription>
            {slot && slot.totalClients > 0
              ? `${slot.totalClients} cliente(s) tienen este horario. Si cambias la hora, se les actualiza automáticamente.`
              : "Define la hora de inicio y fin y los días en que se dicta."}
          </DialogDescription>
        </DialogHeader>
        <form id="slot-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="slot-start">Inicio</Label>
              <Input id="slot-start" type="time" value={startTime} onChange={(e) => onStartChange(e.target.value)} step={300} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slot-end">Fin</Label>
              <Input id="slot-end" type="time" value={endTime} onChange={(e) => setEnd(e.target.value)} step={300} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Días</Label>
            <div className="flex gap-1.5">
              {WEEKDAYS.slice(0, 6).map((w) => {
                const on = weekdays.includes(w.iso);
                return (
                  <button
                    key={w.iso}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setWeekdays((prev) => (on ? prev.filter((d) => d !== w.iso) : [...prev, w.iso].sort()))
                    }
                    className={cn(
                      "flex h-10 flex-1 items-center justify-center rounded-lg border text-sm font-semibold transition-all active:scale-95",
                      on ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground",
                    )}
                  >
                    {w.short}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="slot-form" disabled={save.isPending}>
            {save.isPending && <Spinner />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SlotsManager({ capacity }: { capacity: number }) {
  const slots = useSlots();
  const remove = useDeleteSlot();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimeSlotWithUsage | null>(null);
  const [toDelete, setToDelete] = useState<TimeSlotWithUsage | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-display text-xl">Horarios de clase</CardTitle>
          <CardDescription>Franjas de 1 hora en las que se dictan clases. Cupo por clase: {capacity}.</CardDescription>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <PlusIcon /> Agregar
        </Button>
      </CardHeader>
      <CardContent>
        {!slots.data ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : slots.data.length === 0 ? (
          <EmptyState icon={<ClockIcon />} title="No hay horarios" description="Agrega la primera franja de clase." />
        ) : (
          <ul className="divide-y rounded-xl border">
            {slots.data.map((slot) => {
              const maxDay = Math.max(0, ...Object.values(slot.clientsByWeekday));
              return (
                <li key={slot.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-36 font-heading text-lg font-semibold">
                    {formatTimeRange(slot.startTime, slot.endTime)}
                  </div>
                  <WeekdayDots days={slot.weekdays} />
                  <div className="flex-1 text-xs text-muted-foreground">
                    {slot.totalClients} cliente(s) · máx. {maxDay}/{capacity} en un día
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar horario"
                      onClick={() => {
                        setEditing(slot);
                        setDialogOpen(true);
                      }}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Eliminar horario"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setToDelete(slot)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {dialogOpen && (
        <SlotDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} slot={editing} />
      )}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`¿Eliminar el horario ${toDelete ? formatTimeRange(toDelete.startTime, toDelete.endTime) : ""}?`}
        description="Solo se puede eliminar si ningún cliente lo tiene en su horario ni hay clases futuras agendadas en él. El historial se conserva."
        confirmLabel="Eliminar"
        destructive
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            const res = await remove.mutateAsync(toDelete.id);
            toast.success(res.archived ? "Horario archivado (tenía historial)." : "Horario eliminado.");
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "No se pudo eliminar.");
            throw error;
          }
        }}
      />
    </Card>
  );
}
