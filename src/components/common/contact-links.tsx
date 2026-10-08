import { MailIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPhone, whatsappLink } from "@/lib/format";

/** Acciones rápidas de contacto: WhatsApp, llamada y correo. */
export function ContactButtons({
  phone,
  email,
  message,
  size = "icon-sm",
  compact,
}: {
  phone: string;
  email?: string;
  message?: string;
  size?: "icon-sm" | "icon";
  /** En pantallas pequeñas muestra solo WhatsApp. */
  compact?: boolean;
}) {
  const secondary = compact ? "hidden sm:inline-flex" : undefined;
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size={size} asChild>
            <a href={whatsappLink(phone, message)} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp">
              <MessageCircleIcon className="text-success" />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>WhatsApp {formatPhone(phone)}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size={size} asChild className={secondary}>
            <a href={`tel:${phone}`} aria-label="Llamar">
              <PhoneIcon />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Llamar</TooltipContent>
      </Tooltip>
      {email && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size={size} asChild className={secondary}>
              <a href={`mailto:${email}`} aria-label="Enviar correo">
                <MailIcon />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{email}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
