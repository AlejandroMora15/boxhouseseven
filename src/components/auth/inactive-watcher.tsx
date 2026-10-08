"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { INACTIVE_EVENT } from "@/lib/api-client";
import { InactiveAccountDialog } from "./inactive-dialog";

/** Si la cuenta se inactiva durante la sesión, avisa y cierra la sesión. */
export function InactiveWatcher() {
  const [open, setOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    const onInactive = () => {
      setOpen(true);
      fetch("/api/public/info")
        .then((r) => r.json())
        .then((info: { whatsappPhone?: string | null }) => setWhatsapp(info.whatsappPhone ?? null))
        .catch(() => {});
    };
    window.addEventListener(INACTIVE_EVENT, onInactive);
    return () => window.removeEventListener(INACTIVE_EVENT, onInactive);
  }, []);

  async function close() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    qc.clear();
    // Recarga completa a propósito: limpia todo el estado en memoria de la sesión.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  return <InactiveAccountDialog open={open} onOpenChange={(o) => !o && close()} whatsappPhone={whatsapp} />;
}
