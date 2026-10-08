"use client";

import { UserCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClientForm } from "@/components/clients/client-form";
import { scheduleForPlan } from "@/components/clients/schedule-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useConvertTrial, useSettings, useSlots } from "@/hooks/api/admin";
import { isoWeekday, todayISO } from "@/lib/dates";
import type { ClientInput } from "@/lib/schemas";
import type { TrialItem } from "@/lib/types";

/** Homologa una clase de prueba a cliente (crea el cliente con su plan). */
export function ConvertTrialSheet({
  trial,
  onOpenChange,
}: {
  trial: TrialItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const settings = useSettings();
  const slots = useSlots();
  const convert = useConvertTrial();

  const ready = trial && settings.data && slots.data;
  const today = todayISO();
  const defaults: ClientInput | null = ready
    ? {
        fullName: trial.fullName,
        document: trial.document,
        phone: trial.phone,
        email: trial.email,
        plan: "three_days",
        monthlyFee: settings.data!.priceThreeDays,
        startDate: today,
        isActive: true,
        notes: trial.notes,
        schedule: scheduleForPlan(
          "three_days",
          isoWeekday(trial.classDate) <= 5 ? [{ weekday: isoWeekday(trial.classDate), slotId: trial.slotId }] : [],
          slots.data!,
        ),
      }
    : null;

  return (
    <Sheet open={trial !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="flex items-center gap-2 text-display text-2xl">
            <UserCheckIcon className="size-5 text-success" /> Convertir en cliente
          </SheetTitle>
          <SheetDescription>
            {trial?.fullName} pasará a la lista de clientes con la modalidad y el horario que elijas. Su contraseña
            será su documento.
          </SheetDescription>
        </SheetHeader>
        <div className="bg-background p-4 sm:p-5">
          {defaults && trial ? (
            <ClientForm
              key={trial.id}
              mode="convert"
              defaultValues={defaults}
              submitLabel="Crear cliente"
              footerClassName="bottom-3 lg:bottom-3"
              onCancel={() => onOpenChange(false)}
              onSubmit={async (values) => {
                const { clientId } = await convert.mutateAsync({ id: trial.id, input: values });
                toast.success(`${values.fullName} ahora es cliente de Boxhouseseven.`, {
                  action: { label: "Ver cliente", onClick: () => router.push(`/admin/clientes/${clientId}`) },
                });
                onOpenChange(false);
              }}
            />
          ) : (
            <Skeleton className="h-96 w-full rounded-xl" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
