"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SaveIcon } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { applyServerFieldErrors, TextField } from "@/components/common/form-fields";
import { SectionTitle } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useUpdateSettings } from "@/hooks/api/admin";
import { ApiError } from "@/lib/api-client";
import { formatCOP } from "@/lib/format";
import { settingsSchema, type SettingsInput } from "@/lib/schemas";
import type { Settings } from "@/lib/types";

const FIELDS = [
  "maxPerClass",
  "priceThreeDays",
  "priceDaily",
  "bookingCutoffMinutes",
  "trialWindowDays",
  "whatsappPhone",
  "address",
] as const;

export function GeneralSettingsForm({ settings }: { settings: Settings }) {
  const update = useUpdateSettings();
  const form = useForm<SettingsInput, unknown, z.output<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  });

  useEffect(() => {
    form.reset(settings);
  }, [settings, form]);

  const [priceThreeDays, priceDaily] = useWatch({ control: form.control, name: ["priceThreeDays", "priceDaily"] });

  async function submit(input: z.output<typeof settingsSchema>) {
    try {
      await update.mutateAsync(input);
      toast.success("Configuración guardada.");
    } catch (error) {
      if (error instanceof ApiError) {
        applyServerFieldErrors(error.fields, form.setError as never, FIELDS);
        toast.error(error.message);
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-display text-xl">General</CardTitle>
        <CardDescription>Cupos, reglas de reserva, precios de los planes y datos de contacto.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-6">
          <div className="space-y-3">
            <SectionTitle>Clases y reservas</SectionTitle>
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextField
                control={form.control}
                name="maxPerClass"
                label="Máximo de personas por clase"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                description="Aplica a clientes que reagendan y a clases de prueba."
              />
              <TextField
                control={form.control}
                name="bookingCutoffMinutes"
                label="Antelación mínima (minutos)"
                type="number"
                inputMode="numeric"
                min={0}
                max={1440}
                description="Tiempo antes del inicio para reagendar o agendar."
              />
              <TextField
                control={form.control}
                name="trialWindowDays"
                label="Días disponibles para pruebas"
                type="number"
                inputMode="numeric"
                min={1}
                max={90}
                description="Cuántos días hacia adelante se muestran en la agenda pública."
              />
            </FieldGroup>
          </div>

          <div className="space-y-3">
            <SectionTitle>Precios de los planes</SectionTitle>
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="priceThreeDays"
                label="3 veces por semana"
                type="number"
                inputMode="numeric"
                step={1000}
                description={formatCOP(Number(priceThreeDays) || 0)}
              />
              <TextField
                control={form.control}
                name="priceDaily"
                label="Todos los días"
                type="number"
                inputMode="numeric"
                step={1000}
                description={formatCOP(Number(priceDaily) || 0)}
              />
            </FieldGroup>
            <p className="text-xs text-muted-foreground">
              Son los valores por defecto para clientes nuevos; no cambian la mensualidad de los clientes actuales.
            </p>
          </div>

          <div className="space-y-3">
            <SectionTitle>Contacto</SectionTitle>
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="whatsappPhone"
                label="WhatsApp del gimnasio"
                type="tel"
                inputMode="tel"
                placeholder="300 123 4567"
                description="Se muestra a clientes inactivos y en la confirmación de pruebas."
              />
              <TextField
                control={form.control}
                name="address"
                label="Dirección"
                placeholder="Calle 10 # 5-20, Cartago"
              />
            </FieldGroup>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting ? <Spinner /> : <SaveIcon />}
              Guardar cambios
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
