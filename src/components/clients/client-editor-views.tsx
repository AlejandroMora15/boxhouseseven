"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClient, useCreateClient, useSettings, useUpdateClient } from "@/hooks/api/admin";
import { todayISO } from "@/lib/dates";
import type { ClientInput } from "@/lib/schemas";
import { ClientForm } from "./client-form";

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="ghost" asChild className="-ml-3">
      <Link href={href}>
        <ArrowLeftIcon /> {label}
      </Link>
    </Button>
  );
}

export function NewClientView() {
  const router = useRouter();
  const create = useCreateClient();
  const settings = useSettings();
  const today = todayISO();

  const defaults: ClientInput = {
    fullName: "",
    document: "",
    phone: "",
    email: "",
    plan: "three_days",
    monthlyFee: settings.data?.priceThreeDays ?? 130000,
    startDate: today,
    isActive: true,
    notes: null,
    schedule: [1, 3, 5].map((weekday) => ({ weekday, slotId: 0 })),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackLink href="/admin/clientes" label="Clientes" />
      <PageHeader title="Nuevo cliente" description="Registra sus datos, la mensualidad y su horario de asistencia." />
      {settings.data ? (
        <ClientForm
          mode="create"
          defaultValues={defaults}
          submitLabel="Crear cliente"
          onCancel={() => router.back()}
          onSubmit={async (values) => {
            const { id } = await create.mutateAsync(values);
            toast.success(`${values.fullName} quedó registrado. Su contraseña es su documento.`);
            router.replace(`/admin/clientes/${id}`);
          }}
        />
      ) : (
        <Skeleton className="h-96 w-full rounded-xl" />
      )}
    </div>
  );
}

export function EditClientView({ id }: { id: string }) {
  const router = useRouter();
  const client = useClient(id);
  const update = useUpdateClient(id);

  if (client.isError) return <ErrorState error={client.error} onRetry={() => client.refetch()} />;
  if (!client.data) return <Skeleton className="mx-auto h-96 max-w-3xl rounded-xl" />;

  const c = client.data;
  const schedule = c.schedule.map((s) => ({ weekday: s.weekday, slotId: s.slotId }));
  const defaults: ClientInput = {
    fullName: c.fullName,
    document: c.document,
    phone: c.phone,
    email: c.email,
    plan: c.plan,
    monthlyFee: c.monthlyFee,
    startDate: c.startDate,
    isActive: c.isActive,
    notes: c.notes,
    schedule,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackLink href={`/admin/clientes/${id}`} label={c.fullName} />
      <PageHeader title="Editar cliente" description="Puedes cambiar cualquier dato, incluida la modalidad y el horario." />
      <ClientForm
        key={c.id}
        mode="edit"
        defaultValues={defaults}
        originalSchedule={c.isActive ? schedule : []}
        submitLabel="Guardar cambios"
        onCancel={() => router.back()}
        onSubmit={async (values) => {
          await update.mutateAsync(values);
          toast.success("Cambios guardados.");
          router.replace(`/admin/clientes/${id}`);
        }}
      />
    </div>
  );
}
