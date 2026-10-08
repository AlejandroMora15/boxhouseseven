"use client";

import {
  EllipsisIcon,
  EyeIcon,
  FilterXIcon,
  PencilIcon,
  PowerIcon,
  PowerOffIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActiveBadge, PlanBadge } from "@/components/common/badges";
import { ContactButtons } from "@/components/common/contact-links";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { PersonAvatar } from "@/components/common/person-avatar";
import { ScheduleSummary } from "@/components/common/schedule-summary";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClients, useSetClientStatus } from "@/hooks/api/admin";
import { useUrlState } from "@/hooks/use-url-state";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { formatCOP, formatDocument } from "@/lib/format";
import type { ClientListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS = { all: "Todos", active: "Activos", inactive: "Inactivos" } as const;
const PLAN = { all: "Todos los planes", three_days: "3 días", daily: "Diario" } as const;
const SORT = { name: "Nombre (A-Z)", recent: "Más recientes" } as const;

function pickKey<T extends Record<string, string>>(map: T, value: string | null, fallback: keyof T): keyof T {
  return value && value in map ? (value as keyof T) : fallback;
}

function RowActions({ client }: { client: ClientListItem }) {
  const setStatus = useSetClientStatus();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${client.fullName}`}>
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/admin/clientes/${client.id}`}>
            <EyeIcon /> Ver detalle
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/admin/clientes/${client.id}/editar`}>
            <PencilIcon /> Editar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            setStatus.mutate(
              { id: client.id, isActive: !client.isActive },
              {
                onSuccess: () =>
                  toast.success(`${client.fullName} ahora está ${client.isActive ? "inactivo" : "activo"}.`),
              },
            )
          }
        >
          {client.isActive ? <PowerOffIcon /> : <PowerIcon />}
          {client.isActive ? "Inactivar" : "Activar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ClientsListView() {
  const router = useRouter();
  const { get, set } = useUrlState();
  const q = get("q") ?? "";
  const status = pickKey(STATUS, get("estado"), "all");
  const plan = pickKey(PLAN, get("plan"), "all");
  const sort = pickKey(SORT, get("orden"), "name");
  const page = Math.max(1, Number(get("pagina")) || 1);
  const pageSize = Number(get("tam")) || DEFAULT_PAGE_SIZE;

  const query = { q, status, plan, sort, page, pageSize };
  const clients = useClients(query);
  const filtered = Boolean(q) || status !== "all" || plan !== "all";

  const setFilter = (updates: Record<string, string | number | null>) => set({ ...updates, pagina: null });
  const data = clients.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes"
        description={data ? `${data.total} ${filtered ? "resultados" : "clientes registrados"}` : "Cargando…"}
        actions={
          <Button asChild>
            <Link href="/admin/clientes/nuevo">
              <UserPlusIcon /> Nuevo cliente
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchInput
          value={q}
          onChange={(value) => setFilter({ q: value || null })}
          placeholder="Buscar por nombre, documento, celular o correo"
          className="lg:max-w-sm"
        />
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <Select value={status} onValueChange={(v) => setFilter({ estado: v === "all" ? null : v })}>
            <SelectTrigger className="w-auto min-w-28" aria-label="Estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={plan} onValueChange={(v) => setFilter({ plan: v === "all" ? null : v })}>
            <SelectTrigger className="w-auto min-w-36" aria-label="Plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PLAN).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setFilter({ orden: v === "name" ? null : v })}>
            <SelectTrigger className="w-auto min-w-36" aria-label="Ordenar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtered && (
            <Button variant="ghost" onClick={() => set({ q: null, estado: null, plan: null, pagina: null })}>
              <FilterXIcon /> Limpiar
            </Button>
          )}
        </div>
      </div>

      {clients.isError ? (
        <ErrorState error={clients.error} onRetry={() => clients.refetch()} />
      ) : !data ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title={filtered ? "Sin resultados" : "Aún no hay clientes"}
          description={
            filtered ? "Prueba con otra búsqueda o limpia los filtros." : "Registra el primer cliente del gimnasio."
          }
          action={
            filtered ? (
              <Button variant="outline" onClick={() => set({ q: null, estado: null, plan: null, pagina: null })}>
                Limpiar filtros
              </Button>
            ) : (
              <Button asChild>
                <Link href="/admin/clientes/nuevo">
                  <UserPlusIcon /> Nuevo cliente
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className={cn("space-y-4 transition-opacity", clients.isPlaceholderData && "opacity-60")}>
          {/* Escritorio: tabla */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4">Cliente</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a,button,[role=menuitem]")) return;
                      router.push(`/admin/clientes/${c.id}`);
                    }}
                  >
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <PersonAvatar name={c.fullName} />
                        <div className="min-w-0">
                          <Link href={`/admin/clientes/${c.id}`} className="block truncate font-semibold hover:underline">
                            {c.fullName}
                          </Link>
                          <div className="truncate text-xs text-muted-foreground">
                            CC {formatDocument(c.document)} · {c.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <PlanBadge plan={c.plan} />
                        <span className="text-xs text-muted-foreground">{formatCOP(c.monthlyFee)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <ScheduleSummary schedule={c.schedule} compact />
                    </TableCell>
                    <TableCell>
                      <ActiveBadge isActive={c.isActive} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end">
                        <ContactButtons phone={c.phone} />
                        <RowActions client={c} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Móvil: tarjetas */}
          <ul className="space-y-2 md:hidden">
            {data.items.map((c) => (
              <li key={c.id} className="rounded-xl border bg-card p-3.5 transition-shadow active:shadow-md">
                <div className="flex items-start gap-3">
                  <PersonAvatar name={c.fullName} />
                  <Link href={`/admin/clientes/${c.id}`} className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.fullName}</div>
                    <div className="truncate text-xs text-muted-foreground">CC {formatDocument(c.document)}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <ActiveBadge isActive={c.isActive} />
                      <PlanBadge plan={c.plan} />
                    </div>
                    <div className="mt-2 text-xs">
                      <ScheduleSummary schedule={c.schedule} compact />
                    </div>
                  </Link>
                  <RowActions client={c} />
                </div>
              </li>
            ))}
          </ul>

          <PaginationBar
            page={data.page}
            pageCount={data.pageCount}
            pageSize={data.pageSize}
            total={data.total}
            itemLabel="clientes"
            onPageChange={(p) => set({ pagina: p === 1 ? null : p })}
            onPageSizeChange={(size) => set({ tam: size === DEFAULT_PAGE_SIZE ? null : size, pagina: null })}
          />
        </div>
      )}
    </div>
  );
}
