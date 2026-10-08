"use client";

import { LockKeyholeIcon, MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { whatsappLink } from "@/lib/format";

/** Modal para clientes con cuenta inactiva: deben hablar con el admin. */
export function InactiveAccountDialog({
  open,
  onOpenChange,
  whatsappPhone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whatsappPhone?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="items-center text-center">
          <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive animate-pop-in">
            <LockKeyholeIcon className="size-7" />
          </div>
          <DialogTitle className="text-display text-2xl">Tu cuenta está inactiva</DialogTitle>
          <DialogDescription className="text-base text-balance">
            Para volver a ver tu agenda y reagendar clases, comunícate con el administrador de Boxhouseseven para
            reactivar tu cuenta.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          {whatsappPhone && (
            <Button variant="brand" asChild>
              <a
                href={whatsappLink(whatsappPhone, "Hola, mi cuenta de Boxhouseseven aparece inactiva.")}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircleIcon /> Escribir al administrador
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
