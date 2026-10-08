"use client";

import { CalendarClockIcon, CreditCardIcon, InfoIcon, MapPinIcon, MessageCircleIcon, UserRoundIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/common/page-header";
import { PersonAvatar } from "@/components/common/person-avatar";
import { WeekdayDots } from "@/components/common/schedule-summary";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyProfile } from "@/hooks/api/me";
import { PLANS, weekdayLabel } from "@/lib/constants";
import { formatDateCompact, formatTimeRange } from "@/lib/dates";
import { formatCOP, formatDocument, formatPhone, whatsappLink } from "@/lib/format";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  );
}

/** Perfil del cliente: solo lectura (los cambios los hace el administrador). */
export function ProfileView() {
  const profile = useMyProfile();

  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  if (!profile.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  const p = profile.data;

  return (
    <div className="space-y-5">
      <PageHeader title="Mi perfil" />

      <div className="flex items-center gap-4 rounded-2xl border bg-card p-5">
        <PersonAvatar name={p.fullName} size="lg" />
        <div className="min-w-0">
          <h2 className="truncate font-heading text-2xl font-bold">{p.fullName}</h2>
          <p className="truncate text-sm text-muted-foreground">{p.email}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/8 p-4 text-sm">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-info" />
        <div className="space-y-2">
          <p>
            Tus datos, tu modalidad y tus días de asistencia solo los puede modificar el administrador. Si necesitas un
            cambio, comunícate con el gimnasio.
          </p>
          {p.contact.whatsappPhone && (
            <Button size="sm" variant="outline" asChild>
              <a
                href={whatsappLink(p.contact.whatsappPhone, `Hola, soy ${p.fullName} y necesito actualizar mis datos.`)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircleIcon className="text-success" /> Escribir al gimnasio
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-display text-lg">
              <UserRoundIcon className="size-4" /> Datos personales
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Row label="Nombre">{p.fullName}</Row>
            <Row label="Documento">{formatDocument(p.document)}</Row>
            <Row label="Celular">{formatPhone(p.phone)}</Row>
            <Row label="Correo">
              <span className="break-all">{p.email}</span>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-display text-lg">
              <CreditCardIcon className="size-4" /> Mi plan
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Row label="Modalidad">{PLANS[p.plan].label}</Row>
            <Row label="Mensualidad">{formatCOP(p.monthlyFee)}</Row>
            <Row label="Cliente desde">{formatDateCompact(p.startDate)}</Row>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-display text-lg">
              <CalendarClockIcon className="size-4" /> Días y horario de asistencia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <WeekdayDots days={p.schedule.map((s) => s.weekday)} />
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {p.schedule.map((s) => (
                <li key={s.weekday} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <span className="font-semibold">{weekdayLabel(s.weekday)}</span>
                  <span className="text-muted-foreground">{formatTimeRange(s.startTime, s.endTime)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {p.contact.address && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPinIcon className="size-4" /> {p.contact.address}
        </p>
      )}
    </div>
  );
}
