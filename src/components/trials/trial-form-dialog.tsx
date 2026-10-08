"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { applyServerFieldErrors, TextareaField, TextField } from "@/components/common/form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useCreateTrial, useSlots, useUpdateTrial } from "@/hooks/api/admin";
import { ApiError } from "@/lib/api-client";
import { formatTimeRange, isISODate, isoWeekday, todayISO } from "@/lib/dates";
import { trialUpdateSchema } from "@/lib/schemas";
import type { TrialItem } from "@/lib/types";

type FormInput = z.input<typeof trialUpdateSchema>;
type FormOutput = z.output<typeof trialUpdateSchema>;

const FIELDS = ["fullName", "document", "phone", "email", "classDate", "slotId", "notes"] as const;

/** Crear (admin) o editar una clase de prueba. El admin no tiene límite de cupo. */
export function TrialFormDialog({
  open,
  onOpenChange,
  trial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trial?: TrialItem | null;
}) {
  const slots = useSlots();
  const create = useCreateTrial();
  const update = useUpdateTrial();
  const editing = Boolean(trial);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(trialUpdateSchema),
    defaultValues: {
      fullName: "",
      document: "",
      phone: "",
      email: "",
      classDate: todayISO(),
      slotId: 0,
      notes: null,
      status: "scheduled",
      attendance: null,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      trial
        ? {
            fullName: trial.fullName,
            document: trial.document,
            phone: trial.phone,
            email: trial.email,
            classDate: trial.classDate,
            slotId: trial.slotId,
            notes: trial.notes,
            status: trial.status === "cancelled" ? "cancelled" : "scheduled",
            attendance: trial.attendance,
          }
        : undefined,
    );
  }, [open, trial, form]);

  const classDate = useWatch({ control: form.control, name: "classDate" });
  const weekday = isISODate(classDate) ? isoWeekday(classDate) : null;
  const daySlots = (slots.data ?? []).filter((s) => weekday && s.weekdays.includes(weekday));

  async function submit(values: FormOutput) {
    try {
      if (trial) {
        await update.mutateAsync({ id: trial.id, input: values });
        toast.success("Clase de prueba actualizada.");
      } else {
        await create.mutateAsync(values);
        toast.success(`Clase de prueba agendada para ${values.fullName}.`);
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        applyServerFieldErrors(error.fields, form.setError as never, FIELDS);
        form.setError("root", { message: error.message });
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar clase de prueba" : "Agendar clase de prueba"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Cambia los datos, la fecha o el estado de la clase de prueba."
              : "Para personas que escriben directamente al gimnasio. Desde aquí no aplica el límite de cupo."}
          </DialogDescription>
        </DialogHeader>
        <form id="trial-form" onSubmit={form.handleSubmit(submit)} noValidate>
          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="fullName" label="Nombre completo" className="sm:col-span-2" />
            <TextField control={form.control} name="document" label="Documento" inputMode="numeric" />
            <TextField control={form.control} name="phone" label="Celular" type="tel" inputMode="tel" />
            <TextField control={form.control} name="email" label="Correo" type="email" className="sm:col-span-2" />
            <TextField control={form.control} name="classDate" label="Fecha de la clase" type="date" />
            <Controller
              control={form.control}
              name="slotId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Horario</FieldLabel>
                  <Select
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(v) => field.onChange(Number(v))}
                    disabled={!daySlots.length}
                  >
                    <SelectTrigger className="w-full" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder={daySlots.length ? "Selecciona" : "Sin clases ese día"} />
                    </SelectTrigger>
                    <SelectContent>
                      {daySlots.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {formatTimeRange(s.startTime, s.endTime)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            {editing && (
              <>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Field>
                      <FieldLabel>Estado</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Agendada</SelectItem>
                          <SelectItem value="cancelled">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="attendance"
                  render={({ field }) => (
                    <Field>
                      <FieldLabel>Asistencia</FieldLabel>
                      <Select
                        value={field.value ?? "none"}
                        onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                        disabled={classDate > todayISO()}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin registrar</SelectItem>
                          <SelectItem value="present">Asistió</SelectItem>
                          <SelectItem value="absent">No asistió</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </>
            )}
            <TextareaField control={form.control} name="notes" label="Notas (opcional)" rows={2} className="sm:col-span-2" />
          </FieldGroup>
          {form.formState.errors.root && (
            <p className="mt-3 text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
          )}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="trial-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            {editing ? "Guardar" : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
