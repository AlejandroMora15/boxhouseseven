"use client";

import { CheckIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, QrCodeIcon, Share2Icon } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const noopSubscribe = () => () => {};

/** URL pública de la clase de prueba según el dominio desde el que se abre. */
export function usePublicTrialUrl() {
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => process.env.NEXT_PUBLIC_APP_URL ?? "",
  );
  return `${origin}/clase-de-prueba`;
}

/** Enlace público para promocionar la clase de prueba (copiar, abrir, QR). */
export function ShareLinkCard() {
  const url = usePublicTrialUrl();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!qrOpen) return;
    QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: "#141416", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [qrOpen, url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Enlace copiado. ¡Compártelo en redes!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-sidebar p-5 text-white">
      <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-48 rounded-full bg-brand/30 blur-3xl" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">
            <Share2Icon className="size-3.5" /> Enlace para redes sociales
          </p>
          <p className="mt-1 font-heading text-xl font-semibold">Agenda de clase de prueba gratis</p>
          <p className="mt-1 truncate font-mono text-sm text-white/70">{url}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="brand" onClick={copy}>
            {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copiado" : "Copiar enlace"}
          </Button>
          <Button
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
            onClick={() => setQrOpen(true)}
          >
            <QrCodeIcon /> QR
          </Button>
          <Button
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
            asChild
          >
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLinkIcon /> Abrir
            </a>
          </Button>
        </div>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Código QR de la clase de prueba</DialogTitle>
            <DialogDescription>Imprímelo o compártelo: al escanearlo se abre el formulario de agenda.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center rounded-xl border bg-white p-4">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="Código QR de la clase de prueba" className="size-60" />
            ) : (
              <div className="size-60 animate-pulse rounded bg-muted" />
            )}
          </div>
          {qr && (
            <Button asChild>
              <a href={qr} download="boxhouseseven-clase-de-prueba.png">
                <DownloadIcon /> Descargar PNG
              </a>
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
