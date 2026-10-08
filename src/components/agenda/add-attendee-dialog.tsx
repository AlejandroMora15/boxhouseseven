"use client";

import { CheckIcon, UserPlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PlanBadge, Pill } from "@/components/common/badges";
import { PersonAvatar } from "@/components/common/person-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAddToClass, useClientSearch } from "@/hooks/api/admin";
import { useDebouncedValue } from "@/hooks/use-url-state";
import { formatDateLong, formatTimeRange, todayISO } from "@/lib/dates";
import { formatDocument } from "@/lib/format";

/**
 * Agregar un cliente a una clase puntual (sin límite de cupo), p. ej. alguien
 * que asistió sin estar inscrito. Opcionalmente lo marca como asistente.
 */
export function AddAttendeeDialog({
  open,
  onOpenChange,
  date,
  slotId,
  startTime,
  endTime,
  existingIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  slotId: number;
  startTime: string;
  endTime: string;
  existingIds: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const canMark = date <= todayISO();
  const [markPresent, setMarkPresent] = useState(canMark);
  const search = useClientSearch(debounced);
  const add = useAddToClass();

  async function handleSelect(client: { id: string; fullName: string; isActive: boolean }) {
    if (existingIds.has(client.id) && !markPresent) {
      toast.info(`${client.fullName} ya está en esta clase.`);
      return;
    }
    await add.mutateAsync({ date, slotId, clientId: client.id, markPresent: canMark && markPresent });
    toast.success(`${client.fullName} agregado a la clase${canMark && markPresent ? " y marcado como asistente" : ""}.`);
    setQuery("");
    onOpenChange(false);
  }

  const results = search.data ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery("");
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2">
            <UserPlusIcon className="size-4" /> Agregar asistente
          </DialogTitle>
          <DialogDescription>
            {formatDateLong(date)} · {formatTimeRange(startTime, endTime)}. El cupo máximo no aplica al agregar
            desde aquí.
          </DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false} className="rounded-none">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar por nombre, documento o celular…"
            autoFocus
          />
          <CommandList className="max-h-[50dvh]">
            {debounced.trim().length < 2 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Escribe al menos 2 letras para buscar.
              </div>
            ) : search.isFetching && !results.length ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : (
              <>
                <CommandEmpty>No encontramos clientes con “{debounced}”.</CommandEmpty>
                <CommandGroup heading="Clientes">
                  {results.map((client) => {
                    const already = existingIds.has(client.id);
                    const blocked = !client.isActive && !(canMark && markPresent);
                    return (
                      <CommandItem
                        key={client.id}
                        value={client.id}
                        disabled={blocked || add.isPending}
                        onSelect={() => void handleSelect(client)}
                        className="gap-3 py-2"
                      >
                        <PersonAvatar name={client.fullName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{client.fullName}</div>
                          <div className="text-xs text-muted-foreground">CC {formatDocument(client.document)}</div>
                        </div>
                        {already && (
                          <Pill tone="success" icon={<CheckIcon />}>
                            En la clase
                          </Pill>
                        )}
                        {!client.isActive && <Pill tone="neutral">Inactivo</Pill>}
                        <PlanBadge plan={client.plan} />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
        <div className="flex items-center justify-between gap-3 border-t bg-muted/40 p-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="mark-present"
              checked={canMark && markPresent}
              disabled={!canMark}
              onCheckedChange={(v) => setMarkPresent(v === true)}
            />
            <Label htmlFor="mark-present" className="text-sm font-normal">
              {canMark ? "Marcar como asistió" : "La asistencia se marca el día de la clase"}
            </Label>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
