"use client";

import {
  CalendarPlusIcon,
  EllipsisIcon,
  PencilIcon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
  UserCheckIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AttendanceToggle } from "@/components/agenda/attendance-toggle";
import { Pill, TrialStatusBadge } from "@/components/common/badges";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ContactButtons } from "@/components/common/contact-links";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { PersonAvatar } from "@/components/common/person-avatar";
import { SearchInput } from "@/components/common/search-input";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteTrial, useSetAttendance, useTrials, useUpdateTrial } from "@/hooks/api/admin";
import { useUrlState } from "@/hooks/use-url-state";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { formatDateLong, formatTimeRange, relativeDayLabel, todayISO } from "@/lib/dates";
import { formatDocument, formatPhone } from "@/lib/format";
import type { TrialItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConvertTrialSheet } from "./convert-trial-sheet";
import { ShareLinkCard } from "./share-link-card";
import { TrialFormDialog } from "./trial-form-dialog";

const STATUS_TABS = {
  all: "Todas",
  scheduled: "Agendadas",
  attended: "Asistieron",
  no_show: "No asistieron",
  converted: "Convertidas",
  cancelled: "Canceladas",
} as const;
const WHEN = { all: "Cualquier fecha", upcoming: "Próximas", past: "Pasadas" } as const;

function key<T extends Record<string, string>>(map: T, v: string | null, fallback: keyof T): keyof T {
  return v && v in map ? (v as keyof T) : fallback;
}

function TrialCard({
  trial,
  onEdit,
  onConvert,
}: {
  trial: TrialItem;
  onEdit: (t: TrialItem) => void;
  onConvert: (t: TrialItem) => void;
}) {
  const setAttendance = useSetAttendance();
  const update = useUpdateTrial();
  const remove = useDeleteTrial();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canMark = trial.status !== "cancelled" && trial.classDate <= todayISO();
  const converted = trial.status === "converted";

  function setStatus(status: "scheduled" | "cancelled") {
    update.mutate(
      {
        id: trial.id,
        input: {
          fullName: trial.fullName,
          document: trial.document,
          phone: trial.phone,
          email: trial.email,
          classDate: trial.classDate,
          slotId: trial.slotId,
          notes: trial.notes,
          status,
          attendance: trial.attendance,
        },
      },
      {
        onSuccess: () => toast.success(status === "cancelled" ? "Clase de prueba cancelada." : "Clase de prueba reactivada."),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm md:flex-row md:items-center",
        trial.status === "cancelled" && "opacity-70",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <PersonAvatar name={trial.fullName} trial={!converted} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-semibold">{trial.fullName}</span>
            <TrialStatusBadge status={trial.status} attendance={trial.attendance} classDate={trial.classDate} />
            {trial.source === "admin" && <Pill tone="neutral">Agendada por admin</Pill>}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            CC {formatDocument(trial.document)} · {formatPhone(trial.phone)} · {trial.email}
          </div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1 text-sm">
            <SparklesIcon className="size-3.5 text-warning" />
            <span className="font-medium">
              {relativeDayLabel(trial.classDate) ? `${relativeDayLabel(trial.classDate)}, ` : ""}
              {formatDateLong(trial.classDate)}
            </span>
            <span className="text-muted-foreground">· {formatTimeRange(trial.startTime, trial.endTime)}</span>
          </div>
          {trial.notes && <p className="mt-1.5 text-xs text-muted-foreground italic">“{trial.notes}”</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ContactButtons
          compact
          phone={trial.phone}
          email={trial.email}
          message={`Hola ${trial.fullName.split(" ")[0]}, te escribimos de Boxhouseseven por tu clase de prueba.`}
        />
        {canMark && !converted && (
          <AttendanceToggle
            size="sm"
            value={trial.attendance}
            disabled={setAttendance.isPending}
            onChange={(status) =>
              setAttendance.mutate({ date: trial.classDate, slotId: trial.slotId, trialId: trial.id, status })
            }
          />
        )}
        {converted ? (
          trial.convertedClientId && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/clientes/${trial.convertedClientId}`}>
                <UserCheckIcon /> Ver cliente
              </Link>
            </Button>
          )
        ) : (
          <Button size="sm" onClick={() => onConvert(trial)} disabled={trial.status === "cancelled"}>
            <UserCheckIcon /> Convertir a cliente
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${trial.fullName}`}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(trial)} disabled={converted}>
              <PencilIcon /> Editar / reagendar
            </DropdownMenuItem>
            {!converted &&
              (trial.status === "cancelled" ? (
                <DropdownMenuItem onSelect={() => setStatus("scheduled")}>
                  <RotateCcwIcon /> Reactivar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setStatus("cancelled")}>
                  <XCircleIcon /> Cancelar clase
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
              <Trash2Icon /> Eliminar registro
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Eliminar la clase de prueba de ${trial.fullName}?`}
        description="Se borra el registro. Esta persona podría volver a agendar una clase de prueba desde el enlace público."
        confirmLabel="Eliminar"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(trial.id);
          toast.success("Registro eliminado.");
        }}
      />
    </li>
  );
}

export function TrialsView() {
  const { get, set } = useUrlState();
  const q = get("q") ?? "";
  const status = key(STATUS_TABS, get("estado"), "all");
  const when = key(WHEN, get("cuando"), "all");
  const page = Math.max(1, Number(get("pagina")) || 1);
  const pageSize = Number(get("tam")) || DEFAULT_PAGE_SIZE;

  const trials = useTrials({ q, status, when, page, pageSize });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TrialItem | null>(null);
  const [converting, setConverting] = useState<TrialItem | null>(null);
  const data = trials.data;

  const setFilter = (u: Record<string, string | number | null>) => set({ ...u, pagina: null });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clases de prueba"
        description="Personas que agendaron su clase gratis. Conviértelas en clientes cuando se inscriban."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <CalendarPlusIcon /> Agendar prueba
          </Button>
        }
      />

      <ShareLinkCard />

      <div className="space-y-3">
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
          {Object.entries(STATUS_TABS).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={status === k}
              onClick={() => setFilter({ estado: k === "all" ? null : k })}
              className={cn(
                "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                status === k ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-accent",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput
            value={q}
            onChange={(v) => setFilter({ q: v || null })}
            placeholder="Buscar por nombre, documento o celular"
            className="sm:max-w-sm"
          />
          <Select value={when} onValueChange={(v) => setFilter({ cuando: v === "all" ? null : v })}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Fecha">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(WHEN).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {trials.isError ? (
        <ErrorState error={trials.error} onRetry={() => trials.refetch()} />
      ) : !data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<SparklesIcon />}
          title="No hay clases de prueba con estos filtros"
          description="Comparte el enlace público en redes para recibir nuevas reservas."
        />
      ) : (
        <div className={cn("space-y-4 transition-opacity", trials.isPlaceholderData && "opacity-60")}>
          <ul className="space-y-2.5">
            {data.items.map((t) => (
              <TrialCard
                key={t.id}
                trial={t}
                onEdit={(trial) => {
                  setEditing(trial);
                  setFormOpen(true);
                }}
                onConvert={setConverting}
              />
            ))}
          </ul>
          <PaginationBar
            page={data.page}
            pageCount={data.pageCount}
            pageSize={data.pageSize}
            total={data.total}
            itemLabel="pruebas"
            onPageChange={(p) => set({ pagina: p === 1 ? null : p })}
            onPageSizeChange={(size) => set({ tam: size === DEFAULT_PAGE_SIZE ? null : size, pagina: null })}
          />
        </div>
      )}

      <TrialFormDialog open={formOpen} onOpenChange={setFormOpen} trial={editing} />
      <ConvertTrialSheet trial={converting} onOpenChange={(o) => !o && setConverting(null)} />
    </div>
  );
}
