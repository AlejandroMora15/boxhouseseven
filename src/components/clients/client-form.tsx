"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRoundIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { applyServerFieldErrors, TextareaField, TextField } from "@/components/common/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useSettings, useSlots } from "@/hooks/api/admin";
import { ApiError } from "@/lib/api-client";
import type { Plan } from "@/lib/constants";
import { formatCOP } from "@/lib/format";
import { clientInputSchema, type ClientData, type ClientInput, type ScheduleEntryInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { PlanPicker } from "./plan-picker";
import { ScheduleEditor, scheduleForPlan } from "./schedule-editor";

const KNOWN_FIELDS = [
  "fullName",
  "document",
  "phone",
  "email",
  "plan",
  "monthlyFee",
  "startDate",
  "schedule",
  "notes",
] as const;

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-display text-xl">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Formulario de cliente (crear, editar o convertir una clase de prueba).
 * La contraseña de acceso del cliente es siempre su documento.
 */
export function ClientForm({
  mode,
  defaultValues,
  originalSchedule,
  submitLabel,
  onSubmit,
  onCancel,
  footerClassName,
}: {
  mode: "create" | "edit" | "convert";
  defaultValues: ClientInput;
  originalSchedule?: ScheduleEntryInput[];
  submitLabel: string;
  onSubmit: (values: ClientData) => Promise<unknown>;
  onCancel?: () => void;
  footerClassName?: string;
}) {
  const settings = useSettings();
  const slots = useSlots();
  const form = useForm<ClientInput, unknown, ClientData>({
    resolver: zodResolver(clientInputSchema),
    defaultValues,
  });
  const plan = useWatch({ control: form.control, name: "plan" }) as Plan;

  if (!settings.data || !slots.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  const prices: Record<Plan, number> = { three_days: settings.data.priceThreeDays, daily: settings.data.priceDaily };
  const slotList = slots.data;

  function changePlan(next: Plan) {
    const currentFee = Number(form.getValues("monthlyFee"));
    form.setValue("plan", next, { shouldDirty: true });
    form.setValue("schedule", scheduleForPlan(next, form.getValues("schedule"), slotList), {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
    // Si el valor era el precio de lista del otro plan, se actualiza.
    if (!currentFee || Object.values(prices).includes(currentFee)) {
      form.setValue("monthlyFee", prices[next], { shouldDirty: true });
    }
  }

  async function submit(values: ClientData) {
    try {
      await onSubmit(values);
    } catch (error) {
      if (error instanceof ApiError) {
        const applied = applyServerFieldErrors(error.fields, form.setError as never, KNOWN_FIELDS);
        toast.error(error.message);
        if (!applied) form.setError("root", { message: error.message });
      } else {
        toast.error("No se pudo guardar el cliente.");
      }
    }
  }

  const pending = form.formState.isSubmitting;

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-5">
      <Section
        title="Datos personales"
        description={
          <span className="inline-flex items-center gap-1.5">
            <KeyRoundIcon className="size-3.5" /> El documento será la contraseña para iniciar sesión.
          </span>
        }
      >
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="fullName"
            label="Nombre completo"
            autoComplete="name"
            className="sm:col-span-2"
          />
          <TextField
            control={form.control}
            name="document"
            label="Documento"
            inputMode="numeric"
            autoComplete="off"
            description={mode === "edit" ? "Si lo cambias, también cambia su contraseña." : undefined}
          />
          <TextField control={form.control} name="phone" label="Celular" type="tel" inputMode="tel" placeholder="300 123 4567" />
          <TextField
            control={form.control}
            name="email"
            label="Correo electrónico"
            type="email"
            inputMode="email"
            autoComplete="off"
            className="sm:col-span-2"
          />
        </FieldGroup>
      </Section>

      <Section title="Plan y mensualidad">
        <FieldGroup>
          <PlanPicker value={plan} onChange={changePlan} prices={prices} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="monthlyFee"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="monthlyFee">Valor mensual</FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                      $
                    </span>
                    <input
                      id="monthlyFee"
                      inputMode="numeric"
                      className="h-10 w-full rounded-lg border border-input bg-card pr-3 pl-7 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive sm:h-9 sm:text-sm"
                      value={field.value === undefined || field.value === null ? "" : String(field.value)}
                      onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                      onBlur={field.onBlur}
                      aria-invalid={fieldState.invalid}
                    />
                  </div>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    <span className="text-xs text-muted-foreground">{formatCOP(Number(field.value) || 0)}</span>
                  )}
                </Field>
              )}
            />
            <TextField
              control={form.control}
              name="startDate"
              label="Fecha de inicio"
              type="date"
              description="Desde esta fecha cuenta en sus clases."
            />
          </div>
        </FieldGroup>
      </Section>

      <Section
        title="Horario de asistencia"
        description="Días y hora en que el cliente asiste por defecto. Él puede reagendar clases dentro de la misma semana."
      >
        <Controller
          control={form.control}
          name="schedule"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <ScheduleEditor
                plan={plan}
                value={field.value}
                onChange={field.onChange}
                slots={slotList}
                capacity={settings.data!.maxPerClass}
                original={originalSchedule}
                invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <FieldError>{fieldState.error?.message ?? "Revisa el horario."}</FieldError>
              )}
            </Field>
          )}
        />
        {mode === "edit" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Si cambias el horario, los reagendamientos que el cliente tenga pendientes se reinician.
          </p>
        )}
      </Section>

      <Section title={mode === "convert" ? "Notas" : "Estado y notas"}>
        <FieldGroup>
          {mode !== "convert" && (
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border bg-muted/30 p-4">
                  <span>
                    <span className="block font-semibold">Cliente activo</span>
                    <span className="block text-sm text-muted-foreground">
                      Un cliente inactivo no cuenta en ninguna clase y no puede iniciar sesión.
                    </span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
          )}
          <TextareaField
            control={form.control}
            name="notes"
            label="Notas internas (opcional)"
            placeholder="Lesiones, preferencias, observaciones…"
            rows={3}
          />
        </FieldGroup>
      </Section>

      {form.formState.errors.root && (
        <p className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
      )}

      <div
        className={cn(
          "sticky bottom-20 z-20 flex justify-end gap-2 rounded-xl border bg-background/90 p-3 shadow-lg backdrop-blur lg:bottom-4",
          footerClassName,
        )}
      >
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={pending} className="min-w-36">
          {pending && <Spinner />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
