"use client";

import { CalendarOffIcon, FlagIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useAddClosedDays, useClosedDays, useRemoveClosedDay } from "@/hooks/api/admin";
import { ApiError } from "@/lib/api-client";
import { addDaysISO, formatDateLong, isISODate, todayISO } from "@/lib/dates";
import { colombianHolidays } from "@/lib/holidays-co";

/** Días en que el gimnasio no abre (festivos, vacaciones, eventos). */
export function ClosedDaysManager() {
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const closed = useClosedDays(addDaysISO(today, -30), addDaysISO(today, 400));
  const add = useAddClosedDays();
  const remove = useRemoveClosedDay();
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addOne(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isISODate(day)) return setError("Selecciona una fecha.");
    if (reason.trim().length < 2) return setError("Escribe el motivo.");
    try {
      const res = await add.mutateAsync({ days: [{ day, reason: reason.trim() }] });
      toast.success(
        res.affected
          ? `Día cerrado. ${res.affected} persona(s) tenían clase ese día: avísales.`
          : "Día marcado como cerrado.",
      );
      setDay("");
      setReason("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar.");
    }
  }

  async function addHolidays(targetYear: number) {
    const days = colombianHolidays(targetYear)
      .filter((h) => h.date >= today)
      .map((h) => ({ day: h.date, reason: h.name }));
    if (!days.length) return toast.info("No quedan festivos por agregar este año.");
    try {
      const res = await add.mutateAsync({ days });
      toast.success(
        `${res.added.length} festivo(s) agregados${res.skipped ? ` (${res.skipped} ya estaban)` : ""}.`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudieron agregar los festivos.");
    }
  }

  const upcoming = (closed.data ?? []).filter((d) => d.day >= today);
  const past = (closed.data ?? []).filter((d) => d.day < today);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-display text-xl">Días cerrados y festivos</CardTitle>
        <CardDescription>
          Esos días no hay clases: no aparecen para pruebas ni para reagendar, y los clientes ven el aviso en su agenda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => addHolidays(year)} disabled={add.isPending}>
            <FlagIcon /> Festivos de Colombia {year}
          </Button>
          <Button variant="outline" onClick={() => addHolidays(year + 1)} disabled={add.isPending}>
            <FlagIcon /> Festivos {year + 1}
          </Button>
        </div>

        <form onSubmit={addOne} className="grid grid-cols-1 gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="closed-day">Fecha</Label>
            <Input id="closed-day" type="date" min={today} value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="closed-reason">Motivo</Label>
            <Input
              id="closed-reason"
              value={reason}
              maxLength={120}
              placeholder="Ej: Vacaciones, mantenimiento…"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={add.isPending}>
            {add.isPending ? <Spinner /> : <PlusIcon />} Agregar
          </Button>
          {error && <p className="text-sm font-medium text-destructive sm:col-span-3">{error}</p>}
        </form>

        {!closed.data ? (
          <Skeleton className="h-32 w-full" />
        ) : upcoming.length === 0 ? (
          <EmptyState icon={<CalendarOffIcon />} title="Sin días cerrados próximos" />
        ) : (
          <ul className="divide-y rounded-xl border">
            {upcoming.map((d) => (
              <li key={d.day} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{formatDateLong(d.day)}</div>
                  <div className="truncate text-xs text-muted-foreground">{d.reason}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar ${d.reason}`}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(d.day, { onSuccess: () => toast.success("El día vuelve a tener clases.") })
                  }
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {past.length} día(s) cerrado(s) en los últimos 30 días.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
